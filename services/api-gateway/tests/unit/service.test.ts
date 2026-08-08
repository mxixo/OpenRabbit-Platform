import { describe, expect, it } from "vitest";
import type { WorkerTaskResult } from "@openrabbit/runtime-core";
import { createApiGatewayService } from "../../src/service.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

function createBackend(): PlatformApiBackend {
  const results = new Map<string, WorkerTaskResult>();
  return {
    async installRealEstatePack(orgId) {
      return {
        packId: "pack.real-estate",
        workerIds: [`real-estate.acquisitions.${orgId}`, `real-estate.research.${orgId}`]
      };
    },
    async listWorkers(orgId) {
      return [
        {
          id: `real-estate.acquisitions.${orgId}`,
          role: "acquisitions_analyst",
          displayName: "Acquisitions Analyst",
          status: "active"
        }
      ];
    },
    async submitWorkerTask(input) {
      const result: WorkerTaskResult = {
        workerId: input.workerId,
        taskId: input.taskId,
        status: "completed",
        runtimeProviderId: "openclaw",
        output: { received: input.input },
        completedAt: new Date().toISOString()
      };
      results.set(`${input.orgId}:${input.taskId}`, result);
      return result;
    },
    async getTaskResult(orgId, taskId) {
      return results.get(`${orgId}:${taskId}`);
    }
  };
}

describe("api-gateway service infrastructure", () => {
  it("exposes stable descriptor and lifecycle", async () => {
    const service = createApiGatewayService();
    expect(service.getDescriptor().serviceName).toBe("api-gateway");
    expect(service.getDescriptor().capabilities).toContain("platform-api-v1");
    expect(service.isStarted()).toBe(false);
    await service.start();
    expect(service.isStarted()).toBe(true);
    expect(service.getHealth().status).toBe("ok");
    await service.stop();
    expect(service.getHealth().status).toBe("degraded");
  });

  it("validates request envelopes", () => {
    const service = createApiGatewayService();
    expect(
      service.validateRequest({
        requestId: "r1",
        path: "/health",
        method: "GET"
      }).valid
    ).toBe(true);
    expect(service.validateRequest({ method: "TRACE" }).valid).toBe(false);
  });

  it("handles requests with reliability tracking", async () => {
    const service = createApiGatewayService();
    expect((await service.handleRequest({})).ok).toBe(false);
    await service.start();
    const result = await service.handleRequest({
      requestId: "r2",
      path: "/status",
      method: "GET"
    });
    expect(result.ok).toBe(true);
    expect(service.getReliabilitySnapshot().operationsSucceeded).toBe(1);
    expect(service.getReliabilitySnapshot().operationsFailed).toBe(1);
  });

  it("requires a platform backend for v1 product routes", async () => {
    const service = createApiGatewayService();
    await service.start();
    const result = await service.handleRequest({
      requestId: "r3",
      path: "/v1/orgs/org-1/workers",
      method: "GET"
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("PLATFORM_BACKEND_NOT_REGISTERED");
  });

  it("routes pack install, worker listing, task submission, and task retrieval", async () => {
    const service = createApiGatewayService();
    service.registerPlatformBackend(createBackend());
    await service.start();

    const install = await service.handleRequest({
      requestId: "install-1",
      path: "/v1/orgs/org-1/packs/real-estate/install",
      method: "POST"
    });
    expect(install.ok).toBe(true);
    expect(install.data?.result).toMatchObject({ packId: "pack.real-estate" });

    const workers = await service.handleRequest({
      requestId: "workers-1",
      path: "/v1/orgs/org-1/workers",
      method: "GET"
    });
    expect(workers.ok).toBe(true);
    expect(workers.data?.result).toEqual([
      expect.objectContaining({ role: "acquisitions_analyst" })
    ]);

    const task = await service.handleRequest({
      requestId: "task-1",
      path: "/v1/orgs/org-1/workers/real-estate.acquisitions.org-1/tasks",
      method: "POST",
      body: {
        taskId: "deal-1",
        taskType: "commercial_investment_workflow",
        input: { address: "100 Market St, Phoenix, AZ" }
      }
    });
    expect(task.ok).toBe(true);
    expect(task.data?.result).toMatchObject({
      taskId: "deal-1",
      status: "completed",
      runtimeProviderId: "openclaw"
    });

    const retrieved = await service.handleRequest({
      requestId: "task-get-1",
      path: "/v1/orgs/org-1/tasks/deal-1",
      method: "GET"
    });
    expect(retrieved.ok).toBe(true);
    expect(retrieved.data?.result).toMatchObject({ taskId: "deal-1" });
  });

  it("rejects malformed task requests with a stable API error", async () => {
    const service = createApiGatewayService();
    service.registerPlatformBackend(createBackend());
    await service.start();

    const result = await service.handleRequest({
      requestId: "task-bad",
      path: "/v1/orgs/org-1/workers/worker-1/tasks",
      method: "POST",
      body: {}
    });
    expect(result.ok).toBe(false);
    expect(result.data?.status).toBe(400);
    expect(result.error?.code).toBe("INVALID_TASK_REQUEST");
  });
});
