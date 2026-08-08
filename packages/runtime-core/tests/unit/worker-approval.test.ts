import { describe, expect, it } from "vitest";
import { InMemoryRuntimeProviderRegistry } from "../../src/core/in-memory-runtime-provider-registry.js";
import { InMemoryWorkerOrchestrator } from "../../src/core/in-memory-worker-orchestrator.js";
import { InMemoryWorkerRegistry } from "../../src/core/in-memory-worker-registry.js";
import { MockRuntimeProvider } from "../../src/mocks/mock-runtime-provider.js";

function buildHarness() {
  const workers = new InMemoryWorkerRegistry();
  workers.register({
    id: "worker-approval-1",
    orgId: "org-approval-1",
    role: "acquisitions_analyst",
    displayName: "Acquisitions Analyst",
    mission: "Analyze and act on approved real-estate opportunities",
    runtimePreference: ["mock-runtime"],
    allowedCapabilities: ["real-estate"],
    allowedTools: ["deal.underwrite", "crm.write"],
    memoryScope: "org",
    approvalPolicy: {
      policyId: "acquisitions-human-approval",
      requiresApproval: true
    },
    status: "active"
  });

  let executions = 0;
  let lastMetadata: Record<string, unknown> | undefined;
  const runtime = new MockRuntimeProvider({
    id: "mock-runtime",
    taskHandler(request) {
      executions += 1;
      lastMetadata = request.metadata;
      return {
        taskId: request.taskId,
        sessionId: request.sessionId,
        status: "completed",
        output: { ok: true },
        completedAt: new Date().toISOString()
      };
    }
  });
  const runtimes = new InMemoryRuntimeProviderRegistry();
  runtimes.register(runtime);

  return {
    orchestrator: new InMemoryWorkerOrchestrator({ workers, runtimes }),
    getExecutions: () => executions,
    getLastMetadata: () => lastMetadata
  };
}

describe("worker approval enforcement", () => {
  it("allows read-only analysis without human approval", async () => {
    const harness = buildHarness();
    const result = await harness.orchestrator.runTask({
      workerId: "worker-approval-1",
      taskId: "read-1",
      taskType: "commercial_investment_workflow",
      actionKind: "read",
      input: { address: "100 Market St, Phoenix, AZ" }
    });

    expect(result.status).toBe("completed");
    expect(harness.getExecutions()).toBe(1);
  });

  it("blocks consequential write tasks before runtime execution when approval is absent", async () => {
    const harness = buildHarness();
    const result = await harness.orchestrator.runTask({
      workerId: "worker-approval-1",
      taskId: "write-1",
      taskType: "crm.create_contact",
      actionKind: "write",
      input: { email: "investor@example.com" }
    });

    expect(result.status).toBe("blocked");
    expect(result.error?.code).toBe("approval_required");
    expect(harness.getExecutions()).toBe(0);
  });

  it("executes approved write tasks and forwards approval audit metadata", async () => {
    const harness = buildHarness();
    const result = await harness.orchestrator.runTask({
      workerId: "worker-approval-1",
      taskId: "write-2",
      taskType: "crm.create_contact",
      actionKind: "write",
      approval: {
        granted: true,
        approvalId: "approval-123",
        approvedBy: "user-1",
        approvedAt: "2026-08-08T07:45:00.000Z"
      },
      input: { email: "investor@example.com" }
    });

    expect(result.status).toBe("completed");
    expect(harness.getExecutions()).toBe(1);
    expect(harness.getLastMetadata()).toMatchObject({
      actionKind: "write",
      approvalPolicyId: "acquisitions-human-approval",
      approvalId: "approval-123",
      approvedBy: "user-1",
      approvedAt: "2026-08-08T07:45:00.000Z"
    });
  });
});
