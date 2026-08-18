import { describe, expect, it } from "vitest";
import type { ApprovalRequest, AuditRecord, CalendarPlanItem, WorkerTaskResult } from "@openrabbit/runtime-core";
import { routeWorkspaceApi } from "../../src/workspace-api.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

function backend(): PlatformApiBackend & {
  listWorkspaceEmailItems: NonNullable<Parameters<typeof routeWorkspaceApi>[1]["listWorkspaceEmailItems"]>;
  listWorkspaceRelationships: NonNullable<Parameters<typeof routeWorkspaceApi>[1]["listWorkspaceRelationships"]>;
  listWorkspaceMapItems: NonNullable<Parameters<typeof routeWorkspaceApi>[1]["listWorkspaceMapItems"]>;
  listWorkspaceSocialItems: NonNullable<Parameters<typeof routeWorkspaceApi>[1]["listWorkspaceSocialItems"]>;
  getWorkspaceSocialAutonomyMode: NonNullable<Parameters<typeof routeWorkspaceApi>[1]["getWorkspaceSocialAutonomyMode"]>;
} {
  return {
    async installRealEstatePack() { return { packId: "pack.real-estate", workerIds: [] }; },
    async listWorkers() { return [{ id: "worker-1", role: "ops", displayName: "Ops", status: "active" }]; },
    async submitWorkerTask(input) {
      return { workerId: input.workerId, taskId: input.taskId, status: "completed", completedAt: "2026-08-17T18:00:00.000Z" } satisfies WorkerTaskResult;
    },
    async getTaskResult() { return undefined; },
    async listApprovals() {
      return [{ id: "a1", orgId: "org-1", workerId: "worker-1", taskId: "t1", taskType: "social.publish", input: {}, status: "pending", policyId: "p1", requestedAt: "2026-08-17T17:00:00.000Z" }] satisfies ApprovalRequest[];
    },
    async listAudit() { return [{ timestamp: "2026-08-17T16:00:00.000Z", action: "email.triage" }] as unknown as AuditRecord[]; },
    async decideApproval() { throw new Error("not used"); },
    async listPlanItems() {
      return [{ id: "cal-1", orgId: "org-1", date: "2026-08-17", title: "Client meeting", status: "planned", startAt: "2026-08-17T16:00:00-07:00", createdAt: "2026-08-17T08:00:00.000Z", updatedAt: "2026-08-17T08:00:00.000Z" }] satisfies CalendarPlanItem[];
    },
    async listWorkspaceEmailItems() { return [{ id: "e1", subject: "Showing Thursday", needsAction: true, actionType: "scheduling" }]; },
    async listWorkspaceRelationships() { return [{ id: "r1", displayName: "Investor", priority: "high" }]; },
    async listWorkspaceMapItems() { return [{ id: "m1", label: "Deal", latitude: 33.45, longitude: -112.07, kind: "opportunity" }]; },
    async listWorkspaceSocialItems() { return [{ id: "s1", status: "pending_approval", title: "Buyer post" }]; },
    async getWorkspaceSocialAutonomyMode() { return "approval_required"; }
  };
}

describe("adaptive workspace API", () => {
  it("returns one normalized model for all five work surfaces", async () => {
    const result = await routeWorkspaceApi({ requestId: "w1", method: "GET", path: "/v1/orgs/org-1/workspace?date=2026-08-17" }, backend());
    expect(result).toMatchObject({
      matched: true,
      status: 200,
      data: {
        orgId: "org-1",
        date: "2026-08-17",
        summary: { pendingApprovals: 1, agentActionsToday: 1, scheduledItems: 1, activeWorkers: 1 },
        focusRecommendation: "email",
        surfaces: {
          calendar: { status: "ready" },
          email: { status: "ready" },
          crm: { status: "ready" },
          map: { status: "ready" },
          social: { status: "ready", data: { autonomyMode: "approval_required" } }
        }
      }
    });
  });

  it("reports missing integrations without inventing data", async () => {
    const base = backend();
    const minimal: PlatformApiBackend = {
      installRealEstatePack: base.installRealEstatePack,
      listWorkers: base.listWorkers,
      submitWorkerTask: base.submitWorkerTask,
      getTaskResult: base.getTaskResult,
      listApprovals: base.listApprovals,
      listAudit: base.listAudit,
      decideApproval: base.decideApproval,
      listPlanItems: base.listPlanItems
    };
    const result = await routeWorkspaceApi({ requestId: "w2", method: "GET", path: "/v1/orgs/org-1/workspace?date=2026-08-17" }, minimal);
    if (!result.matched || !result.data) throw new Error("workspace route did not return data");
    const data = result.data as { surfaces: Record<string, { status: string; data: { items: unknown[] } }> };
    expect(data.surfaces.email.status).toBe("not_connected");
    expect(data.surfaces.email.data.items).toEqual([]);
    expect(data.surfaces.crm.status).toBe("not_connected");
    expect(data.surfaces.map.status).toBe("not_connected");
    expect(data.surfaces.social.status).toBe("not_connected");
  });
});
