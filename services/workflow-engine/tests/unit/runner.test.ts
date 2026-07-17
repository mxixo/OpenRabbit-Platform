import { describe, expect, it } from "vitest";
import { InMemoryWorkflowRunner } from "../../src/runner.js";
import { WorkflowDefinition } from "../../src/contracts.js";

const baseDefinition: WorkflowDefinition = {
  workflowId: "wf-demo",
  version: "0.1.0",
  name: "Demo",
  steps: [
    {
      id: "capture",
      name: "Capture",
      action: "capture.run",
      guardrails: { policyCheck: true, requiresApproval: false, maxRetries: 1 }
    },
    {
      id: "approve",
      name: "Approve",
      action: "approve.run",
      guardrails: { policyCheck: true, requiresApproval: true, maxRetries: 0 }
    }
  ]
};

describe("in-memory workflow runner", () => {
  it("completes a workflow with approvals", async () => {
    const runner = new InMemoryWorkflowRunner();
    const result = await runner.run(
      baseDefinition,
      {
        correlationId: "c1",
        initiatedBy: "tester",
        variables: {},
        approvals: { approve: true }
      },
      {
        "capture.run": async () => ({ ok: true, output: { captured: true } }),
        "approve.run": async () => ({ ok: true, output: { approved: true } })
      }
    );
    expect(result.status).toBe("completed");
    expect(result.completedSteps).toEqual(["capture", "approve"]);
  });

  it("blocks when approval is required but missing", async () => {
    const runner = new InMemoryWorkflowRunner();
    const result = await runner.run(
      baseDefinition,
      {
        correlationId: "c2",
        initiatedBy: "tester",
        variables: {}
      },
      {
        "capture.run": async () => ({ ok: true }),
        "approve.run": async () => ({ ok: true })
      }
    );
    expect(result.status).toBe("blocked");
    expect(result.blockedStepId).toBe("approve");
  });

  it("fails on non-recoverable step error", async () => {
    const runner = new InMemoryWorkflowRunner();
    const result = await runner.run(
      {
        ...baseDefinition,
        steps: [baseDefinition.steps[0]]
      },
      {
        correlationId: "c3",
        initiatedBy: "tester",
        variables: {}
      },
      {
        "capture.run": async () => ({ ok: false, error: "boom", recoverable: false })
      }
    );
    expect(result.status).toBe("failed");
    expect(result.failedStepId).toBe("capture");
  });
});
