import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { WorkflowExecutionResult } from "../../src/contracts.js";
import { FilesystemWorkflowIdempotencyStore } from "../../src/filesystem-idempotency.js";

const temporaryDirectories: string[] = [];

async function makeStore(): Promise<{
  directory: string;
  store: FilesystemWorkflowIdempotencyStore;
}> {
  const directory = await mkdtemp(join(tmpdir(), "openrabbit-idempotency-"));
  temporaryDirectories.push(directory);
  return {
    directory,
    store: new FilesystemWorkflowIdempotencyStore(directory)
  };
}

function completedResult(): WorkflowExecutionResult {
  return {
    workflowId: "wf-durable",
    status: "completed",
    completedSteps: ["write"],
    events: [
      {
        type: "workflow.completed",
        workflowId: "wf-durable",
        timestamp: "2026-09-20T12:00:00.000Z"
      }
    ]
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("FilesystemWorkflowIdempotencyStore", () => {
  it("persists an in-progress claim across store instances", async () => {
    const { directory, store } = await makeStore();
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-1"]';

    expect(await store.claim(scopeKey)).toEqual({ state: "acquired" });

    const afterRestart = new FilesystemWorkflowIdempotencyStore(directory);
    expect(await afterRestart.claim(scopeKey)).toEqual({ state: "in_progress" });
  });

  it("replays a completed result after a process-style restart", async () => {
    const { directory, store } = await makeStore();
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-2"]';
    const result = completedResult();

    expect(await store.claim(scopeKey)).toEqual({ state: "acquired" });
    await store.complete(scopeKey, result);

    const afterRestart = new FilesystemWorkflowIdempotencyStore(directory);
    expect(await afterRestart.claim(scopeKey)).toEqual({
      state: "completed",
      result
    });
  });

  it("allows only one concurrent claimant across independent store instances", async () => {
    const { directory } = await makeStore();
    const first = new FilesystemWorkflowIdempotencyStore(directory);
    const second = new FilesystemWorkflowIdempotencyStore(directory);
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-3"]';

    const claims = await Promise.all([first.claim(scopeKey), second.claim(scopeKey)]);
    const states = claims.map((claim) => claim.state).sort();

    expect(states).toEqual(["acquired", "in_progress"]);
  });

  it("never overwrites an already completed terminal result", async () => {
    const { store } = await makeStore();
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-4"]';

    await store.claim(scopeKey);
    await store.complete(scopeKey, completedResult());

    await expect(store.complete(scopeKey, completedResult())).rejects.toThrow(
      "already completed"
    );
  });

  it("requires a durable claim before completion", async () => {
    const { store } = await makeStore();

    await expect(
      store.complete(
        '["tenant-a","wf-durable","1.0.0","unclaimed"]',
        completedResult()
      )
    ).rejects.toThrow("durably claimed");
  });
});
