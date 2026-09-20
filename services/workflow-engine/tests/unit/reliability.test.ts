import { describe, expect, it } from "vitest";
import { WorkflowDefinition } from "../../src/contracts.js";
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
