import { describe, expect, it } from "vitest";
import { WorkflowDefinition, WorkflowExecutionResult } from "../../src/contracts.js";
import {
  WorkflowIdempotencyClaim,
  WorkflowIdempotencyStore
} from "../../src/reliability.js";
import { InMemoryWorkflowRunner } from "../../src/runner.js";

const definition: WorkflowDefinition = {
  workflowId: "wf-idempotent",
  version: "1.0.0",
  name: "Idempotent workflow",
  steps: [
    {
      id: "write",
      name: "Write",
      action: "write.run",
      guardrails: { policyCheck: true, requiresApproval: false, maxRetries: 0 }
    }
  ]
};

class ThrowingIdempotencyStore implements WorkflowIdempotencyStore {
  constructor(private readonly failurePhase: "claim" | "complete") {}

  async claim(_scopeKey: string): Promise<WorkflowIdempotencyClaim> {
    if (this.failurePhase === "claim") {
      throw new Error("store unavailable");
    }
    return { state: "acquired" };
  }

  async complete(_scopeKey: string, _result: WorkflowExecutionResult): Promise<void> {
    if (this.failurePhase === "complete") {
      throw new Error("commit timeout");
    }
  }
}

describe("tenant-scoped workflow idempotency", () => {
  it("replays a completed result without re-running side effects", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    const handlers = {
      "write.run": async () => {
        executions += 1;
        return { ok: true, output: { executions } };
      }
    };

    const first = await runner.run(
      definition,
      {
        correlationId: "corr-1",
        initiatedBy: "tester",
        variables: {},
        tenantId: "tenant-a",
        idempotencyKey: "lead-42"
      },
      handlers
    );
    const replay = await runner.run(
      definition,
      {
        correlationId: "corr-2",
        initiatedBy: "tester",
        variables: {},
        tenantId: "tenant-a",
        idempotencyKey: "lead-42"
      },
      handlers
    );

    expect(first.status).toBe("completed");
    expect(replay.status).toBe("completed");
    expect(executions).toBe(1);
    expect(replay.events.at(-1)?.type).toBe("workflow.replayed");
  });

  it("blocks a concurrent duplicate before its handler can execute", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    let releaseFirst!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const handlers = {
      "write.run": async () => {
        executions += 1;
        markStarted();
        await firstMayFinish;
        return { ok: true };
      }
    };
    const context = {
      correlationId: "corr-concurrent-1",
      initiatedBy: "tester",
      variables: {},
      tenantId: "tenant-a",
      idempotencyKey: "concurrent-key"
    };

    const firstRun = runner.run(definition, context, handlers);
    await firstStarted;

    const duplicate = await runner.run(
      definition,
      { ...context, correlationId: "corr-concurrent-2" },
      handlers
    );

    expect(duplicate.status).toBe("blocked");
    expect(duplicate.deadLetterReason).toContain("already in progress");
    expect(executions).toBe(1);

    releaseFirst();
    const completed = await firstRun;
    expect(completed.status).toBe("completed");

    const replay = await runner.run(
      definition,
      { ...context, correlationId: "corr-concurrent-3" },
      handlers
    );
    expect(replay.status).toBe("completed");
    expect(replay.events.at(-1)?.type).toBe("workflow.replayed");
    expect(executions).toBe(1);
  });

  it("keeps an unsuccessful claimed execution fail-closed instead of risking duplicate side effects", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    const context = {
      correlationId: "corr-failure-1",
      initiatedBy: "tester",
      variables: {},
      tenantId: "tenant-a",
      idempotencyKey: "failed-key"
    };
    const handlers = {
      "write.run": async () => {
        executions += 1;
        return { ok: false, error: "provider timeout", recoverable: false };
      }
    };

    const first = await runner.run(definition, context, handlers);
    const duplicate = await runner.run(
      definition,
      { ...context, correlationId: "corr-failure-2" },
      handlers
    );

    expect(first.status).toBe("failed");
    expect(duplicate.status).toBe("blocked");
    expect(duplicate.deadLetterReason).toContain("already in progress");
    expect(executions).toBe(1);
  });

  it("fails closed before any side effect when idempotency claim storage is unavailable", async () => {
    const runner = new InMemoryWorkflowRunner(
      { maxAttempts: 3 },
      new ThrowingIdempotencyStore("claim")
    );
    let executions = 0;

    const result = await runner.run(
      definition,
      {
        correlationId: "corr-storage-claim",
        initiatedBy: "tester",
        variables: {},
        tenantId: "tenant-a",
        idempotencyKey: "storage-key"
      },
      {
        "write.run": async () => {
          executions += 1;
          return { ok: true };
        }
      }
    );

    expect(result.status).toBe("failed");
    expect(result.deadLetterReason).toContain("claim failed before side effects");
    expect(result.deadLetterReason).toContain("store unavailable");
    expect(executions).toBe(0);
    expect(result.events.at(-1)?.type).toBe("workflow.failed");
    expect(result.events.at(-1)?.details?.phase).toBe("claim");
  });

  it("marks the outcome uncertain when completion persistence fails after side effects", async () => {
    const runner = new InMemoryWorkflowRunner(
      { maxAttempts: 3 },
      new ThrowingIdempotencyStore("complete")
    );
    let executions = 0;

    const result = await runner.run(
      definition,
      {
        correlationId: "corr-storage-complete",
        initiatedBy: "tester",
        variables: {},
        tenantId: "tenant-a",
        idempotencyKey: "storage-key"
      },
      {
        "write.run": async () => {
          executions += 1;
          return { ok: true };
        }
      }
    );

    expect(executions).toBe(1);
    expect(result.status).toBe("failed");
    expect(result.completedSteps).toEqual(["write"]);
    expect(result.deadLetterReason).toContain("provider reconciliation is required before retry");
    expect(result.deadLetterReason).toContain("commit timeout");
    expect(result.events.at(-1)?.type).toBe("workflow.failed");
    expect(result.events.at(-1)?.details?.phase).toBe("complete");
  });

  it("never shares an idempotency result across tenants", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    const handlers = {
      "write.run": async () => {
        executions += 1;
        return { ok: true };
      }
    };

    for (const tenantId of ["tenant-a", "tenant-b"]) {
      await runner.run(
        definition,
        {
          correlationId: `corr-${tenantId}`,
          initiatedBy: "tester",
          variables: {},
          tenantId,
          idempotencyKey: "same-key"
        },
        handlers
      );
    }

    expect(executions).toBe(2);
  });

  it("includes workflow version in the idempotency scope", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    const handlers = {
      "write.run": async () => {
        executions += 1;
        return { ok: true };
      }
    };
    const context = {
      correlationId: "corr-version",
      initiatedBy: "tester",
      variables: {},
      tenantId: "tenant-a",
      idempotencyKey: "same-key"
    };

    await runner.run(definition, context, handlers);
    await runner.run({ ...definition, version: "2.0.0" }, context, handlers);

    expect(executions).toBe(2);
  });

  it("fails closed when only one idempotency scope field is supplied", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    const result = await runner.run(
      definition,
      {
        correlationId: "corr-invalid",
        initiatedBy: "tester",
        variables: {},
        idempotencyKey: "missing-tenant"
      },
      {
        "write.run": async () => {
          executions += 1;
          return { ok: true };
        }
      }
    );

    expect(result.status).toBe("failed");
    expect(result.deadLetterReason).toContain("supplied together");
    expect(executions).toBe(0);
  });

  it("preserves legacy behavior when no idempotency key is supplied", async () => {
    const runner = new InMemoryWorkflowRunner();
    let executions = 0;
    const handlers = {
      "write.run": async () => {
        executions += 1;
        return { ok: true };
      }
    };
    const context = {
      correlationId: "corr-legacy",
      initiatedBy: "tester",
      variables: {}
    };

    await runner.run(definition, context, handlers);
    await runner.run(definition, context, handlers);

    expect(executions).toBe(2);
  });
});
