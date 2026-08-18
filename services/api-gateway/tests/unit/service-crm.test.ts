import { describe, expect, it } from "vitest";
import type { ApprovalRequest, AuditRecord, WorkerTaskResult } from "@openrabbit/runtime-core";
import { createApiGatewayService } from "../../src/service.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

function backend(): PlatformApiBackend {
  return {
    async installRealEstatePack() { return { packId: "pack.real-estate", workerIds: [] }; },
    async listWorkers() { return []; },
    async submitWorkerTask(input) { return { workerId: input.workerId, taskId: input.taskId, status: "completed", completedAt: new Date().toISOString() } satisfies WorkerTaskResult; },
    async getTaskResult() { return undefined; },
    async listApprovals() { return [] satisfies ApprovalRequest[]; },
    async listAudit() { return [] satisfies AuditRecord[]; },
    async decideApproval() { throw new Error("not used"); }
  };
}

describe("api gateway native CRM", () => {
  it("creates a relationship and projects it into the adaptive workspace", async () => {
    const service = createApiGatewayService();
    service.registerPlatformBackend(backend());
    await service.start();

    const created = await service.handleRequest({ requestId: "crm-create", method: "POST", path: "/v1/orgs/org-1/crm/relationships", body: { displayName: "Paris Robbins", kind: "investor", priority: "high", leadSource: "referral" } });
    expect(created.ok).toBe(true);
    expect(created.data?.status).toBe(201);

    const workspace = await service.handleRequest({ requestId: "workspace", method: "GET", path: "/v1/orgs/org-1/workspace?date=2026-08-17" });
    expect(workspace.ok).toBe(true);
    expect(workspace.data?.result).toMatchObject({
      focusRecommendation: "crm",
      surfaces: { crm: { status: "ready", data: { items: [expect.objectContaining({ displayName: "Paris Robbins", priority: "high" })] } } }
    });
  });

  it("imports connected-CRM records through the same gateway boundary", async () => {
    const service = createApiGatewayService();
    service.registerPlatformBackend(backend());
    await service.start();

    const imported = await service.handleRequest({
      requestId: "crm-import",
      method: "POST",
      path: "/v1/orgs/org-1/crm/import",
      body: { provider: "hubspot", records: [{ externalId: "hs-10", displayName: "Imported Seller", email: "seller@example.com", kind: "lead", priority: "medium" }] }
    });
    expect(imported.ok).toBe(true);
    expect(imported.data?.result).toMatchObject({ provider: "hubspot", created: 1, updated: 0 });

    const listed = await service.handleRequest({ requestId: "crm-list", method: "GET", path: "/v1/orgs/org-1/crm/relationships" });
    expect(listed.ok).toBe(true);
    expect(listed.data?.result).toEqual([
      expect.objectContaining({ displayName: "Imported Seller", sourceProvider: "hubspot", externalId: "hs-10" })
    ]);
  });
});
