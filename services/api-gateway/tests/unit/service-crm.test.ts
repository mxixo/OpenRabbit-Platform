import { describe, expect, it } from "vitest";
import type { PlatformApiBackend } from "../../src/platform-api.js";
import { createApiGatewayService } from "../../src/service.js";

function backend(): PlatformApiBackend {
  return {
    async installRealEstatePack() { return { packId: "pack.real-estate", workerIds: [] }; },
    async listWorkers() { return []; },
    async submitWorkerTask(input) { return { workerId: input.workerId, taskId: input.taskId, status: "completed", completedAt: new Date().toISOString() }; },
    async getTaskResult() { return undefined; },
    async listApprovals() { return []; },
    async listAudit() { return []; },
    async decideApproval() { throw new Error("not used"); },
    async listPlanItems() { return []; }
  };
}

describe("gateway native CRM integration", () => {
  it("makes native CRM records visible through the adaptive workspace", async () => {
    const service = createApiGatewayService();
    service.registerPlatformBackend(backend());
    await service.start();

    const create = await service.handleRequest({
      requestId: "crm-create",
      method: "POST",
      path: "/v1/orgs/org-1/crm/relationships",
      body: { id: "client-1", displayName: "Client One", kind: "buyer", priority: "high", stage: "active" }
    });
    expect(create.ok).toBe(true);
    expect(create.data?.status).toBe(201);

    const workspace = await service.handleRequest({
      requestId: "workspace",
      method: "GET",
      path: "/v1/orgs/org-1/workspace?date=2026-08-17"
    });
    expect(workspace.ok).toBe(true);
    expect(workspace.data?.result).toMatchObject({
      focusRecommendation: "crm",
      surfaces: {
        crm: {
          status: "ready",
          data: { items: [{ id: "client-1", displayName: "Client One", kind: "buyer", priority: "high", stage: "active" }] }
        }
      }
    });
  });
});
