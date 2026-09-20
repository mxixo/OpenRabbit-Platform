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

async function acquire(
  store: FilesystemWorkflowIdempotencyStore,
  scopeKey: string
): Promise<string> {
  const claim = await store.claim(scopeKey);
  expect(claim.state).toBe("acquired");
  if (claim.state !== "acquired") {
    throw new Error("expected idempotency claim to be acquired");
  }
  expect(claim.claimToken).toBeTruthy();
  return claim.claimToken;
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

    await acquire(store, scopeKey);

    const afterRestart = new FilesystemWorkflowIdempotencyStore(directory);
    expect(await afterRestart.claim(scopeKey)).toEqual({ state: "in_progress" });
  });

  it("replays a completed result after a process-style restart", async () => {
    const { directory, store } = await makeStore();
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-2"]';
    const result = completedResult();

    const claimToken = await acquire(store, scopeKey);
    await store.complete(scopeKey, claimToken, result);

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
    const winner = claims.find((claim) => claim.state === "acquired");
    expect(winner && "claimToken" in winner ? winner.claimToken : undefined).toBeTruthy();
  });

  it("never overwrites an already completed terminal result", async () => {
    const { store } = await makeStore();
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-4"]';

    const claimToken = await acquire(store, scopeKey);
    await store.complete(scopeKey, claimToken, completedResult());

    await expect(
      store.complete(scopeKey, claimToken, completedResult())
    ).rejects.toThrow("already completed");
  });

  it("requires a durable claim before completion", async () => {
    const { store } = await makeStore();

    await expect(
      store.complete(
        '["tenant-a","wf-durable","1.0.0","unclaimed"]',
        "not-an-owner",
        completedResult()
      )
    ).rejects.toThrow("durably claimed");
  });

  it("rejects completion from a stale or foreign claim owner", async () => {
    const { store } = await makeStore();
    const scopeKey = '["tenant-a","wf-durable","1.0.0","request-fenced"]';

    const claimToken = await acquire(store, scopeKey);
    await expect(
      store.complete(scopeKey, `${claimToken}-stale`, completedResult())
    ).rejects.toThrow("does not own this scope");

    await store.complete(scopeKey, claimToken, completedResult());
    expect((await store.claim(scopeKey)).state).toBe("completed");
  });
});
