import { describe, expect, it } from "vitest";
import type {
  ApprovalRequest,
  AuditRecord,
  CalendarPlanItem,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import { routeTodayApi } from "../../src/today-api.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

function baseBackend(): PlatformApiBackend {
  return {
    async installRealEstatePack() {
      return { packId: "pack.real-estate", workerIds: [] };
    },
    async listWorkers() {
      return [
        { id: "worker-1", role: "acquisitions", displayName: "Acquisitions", status: "active" },
        { id: "worker-2", role: "research", displayName: "Research", status: "inactive" }
      ];
    },
    async submitWorkerTask(input) {
      return {
        workerId: input.workerId,
        taskId: input.taskId,
        status: "completed",
        completedAt: "2026-08-17T17:00:00.000Z"
      } satisfies WorkerTaskResult;
    },
    async getTaskResult() {
      return undefined;
    },
    async listApprovals() {
      return [
        {
          id: "approval-1",
          orgId: "org-1",
          workerId: "worker-1",
          taskId: "task-1",
          taskType: "email.send",
          input: {},
          status: "pending",
          policyId: "policy-1",
          requestedAt: "2026-08-17T18:00:00.000Z"
        },
        {
          id: "approval-2",
          orgId: "org-1",
          workerId: "worker-1",
          taskId: "task-2",
          taskType: "crm.update",
          input: {},
          status: "approved",
          policyId: "policy-1",
          requestedAt: "2026-08-17T18:05:00.000Z"
        }
      ] satisfies ApprovalRequest[];
    },
    async listAudit() {
      return [
        { timestamp: "2026-08-17T18:01:00.000Z", action: "email.draft" },
        { timestamp: "2026-08-16T18:01:00.000Z", action: "crm.read" }
      ] as unknown as AuditRecord[];
    },
    async decideApproval() {
      throw new Error("not used");
    },
    async listPlanItems() {
      return [
        {
          id: "item-1",
          orgId: "org-1",
          date: "2026-08-17",
          title: "Client meeting",
          status: "planned",
          startAt: "2026-08-17T16:00:00-07:00",
          createdAt: "2026-08-17T08:00:00.000Z",
          updatedAt: "2026-08-17T08:00:00.000Z"
        }
      ] satisfies CalendarPlanItem[];
    }
  };
}

describe("Today surface API", () => {
  it("combines approvals, worker state, audit activity, and schedule into one read model", async () => {
    const result = await routeTodayApi(
      {
        requestId: "today-1",
        method: "GET",
        path: "/v1/orgs/org-1/today?date=2026-08-17"
      },
      baseBackend()
    );

    expect(result).toMatchObject({
      matched: true,
      status: 200,
      data: {
        date: "2026-08-17",
        summary: {
          pendingApprovals: 1,
          agentActionsToday: 1,
          scheduledItems: 1,
          activeWorkers: 1
        }
      }
    });
    if (!result.matched || !result.data) throw new Error("Today route did not return data");
    const data = result.data as { pendingApprovals: ApprovalRequest[]; planItems: CalendarPlanItem[] };
    expect(data.pendingApprovals).toHaveLength(1);
    expect(data.planItems[0]?.title).toBe("Client meeting");
  });

  it("falls through for unrelated routes", async () => {
    const result = await routeTodayApi(
      {
        requestId: "today-miss",
        method: "GET",
        path: "/v1/orgs/org-1/workers"
      },
      baseBackend()
    );
    expect(result).toEqual({ matched: false });
  });
});
