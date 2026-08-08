import { describe, expect, it } from "vitest";
import {
  InMemoryRuntimeProviderRegistry,
  InMemoryWorkerOrchestrator,
  InMemoryWorkerRegistry,
  MockRuntimeProvider
} from "@openrabbit/runtime-core";
import { createOrchestratorService } from "../../src/service.js";

function buildWorkerOrchestrator() {
  const workers = new InMemoryWorkerRegistry();
  workers.register({
    id: "worker-acq-1",
    orgId: "org-1",
    role: "acquisitions_analyst",
    displayName: "Acquisitions Analyst",
    mission: "Underwrite investment opportunities",
    runtimePreference: ["mock-runtime"],
    allowedCapabilities: ["real-estate"],
    allowedTools: ["deal.underwrite"],
    memoryScope: "worker",
    approvalPolicy: { policyId: "acquisitions-default" },
    status: "active"
  });

  let executionCount = 0;
  const runtime = new MockRuntimeProvider({
    id: "mock-runtime",
    taskHandler(request, session) {
      executionCount += 1;
      return {
        taskId: request.taskId,
        sessionId: session.sessionId,
        status: "completed",
        output: {
          taskType: request.taskType,
          input: request.input,
          workerId: session.workerId
        },
        completedAt: new Date().toISOString()
      };
    }
  });
  const runtimes = new InMemoryRuntimeProviderRegistry();
  runtimes.register(runtime);

  return {
    orchestrator: new InMemoryWorkerOrchestrator({ workers, runtimes }),
    getExecutionCount: () => executionCount
  };
}

describe("orchestrator service infrastructure", () => {
  it("manages lifecycle and exposes descriptor", async () => {
    const service = createOrchestratorService();
    expect(service.getDescriptor().serviceName).toBe("orchestrator");
    expect(service.getDescriptor().capabilities).toContain("worker-task-routing");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });

  it("accepts valid task intake only after startup", async () => {
    const service = createOrchestratorService();
    expect(
      await service.intakeTask({ taskId: "t1", taskType: "sync", payload: {} })
    ).toEqual({ accepted: false, reason: "service not started" });

    await service.start();
    expect(
      await service.intakeTask({ taskId: "t1", taskType: "sync", payload: {} })
    ).toEqual({ accepted: true });
    expect(
      await service.intakeTask({ taskId: "t1", taskType: "sync", payload: {} })
    ).toEqual({ accepted: true, duplicate: true, reason: "duplicate task ignored" });
    expect(service.getReliabilitySnapshot().operationsSucceeded).toBe(2);
    expect(service.getReliabilitySnapshot().operationsFailed).toBe(1);
  });

  it("routes worker tasks through runtime-core WorkerOrchestrator", async () => {
    const service = createOrchestratorService();
    const workerRuntime = buildWorkerOrchestrator();
    service.registerWorkerOrchestrator(workerRuntime.orchestrator);
    await service.start();

    const request = {
      workerId: "worker-acq-1",
      taskId: "deal-1",
      taskType: "commercial_investment_workflow",
      input: { address: "100 Market St, Phoenix, AZ" }
    };

    const first = await service.runWorkerTask(request);
    expect(first.status).toBe("completed");
    expect(first.runtimeProviderId).toBe("mock-runtime");
    expect(first.output).toMatchObject({
      taskType: "commercial_investment_workflow",
      workerId: "worker-acq-1"
    });
    expect(workerRuntime.getExecutionCount()).toBe(1);

    const duplicate = await service.runWorkerTask(request);
    expect(duplicate).toEqual(first);
    expect(workerRuntime.getExecutionCount()).toBe(1);
  });

  it("returns stable worker routing failures before dispatch", async () => {
    const service = createOrchestratorService();
    const beforeStart = await service.runWorkerTask({
      workerId: "worker-acq-1",
      taskId: "task-1",
      taskType: "analysis",
      input: {}
    });
    expect(beforeStart.error?.code).toBe("SERVICE_NOT_STARTED");

    await service.start();
    const noOrchestrator = await service.runWorkerTask({
      workerId: "worker-acq-1",
      taskId: "task-2",
      taskType: "analysis",
      input: {}
    });
    expect(noOrchestrator.error?.code).toBe("WORKER_ORCHESTRATOR_NOT_REGISTERED");
  });

  it("routes MCP requests to registered MCP server", async () => {
    const service = createOrchestratorService();
    await service.start();
    service.registerMcpServer({
      async handleRequest(request) {
        return { id: request.id, result: { echoedMethod: request.method } };
      }
    });
    await expect(
      service.routeMcpRequest({ id: "m1", method: "tools/list" })
    ).resolves.toEqual({
      id: "m1",
      result: { echoedMethod: "tools/list" }
    });
  });
});
