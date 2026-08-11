import { describe, expect, it } from "vitest";
import type {
  ApprovalRequest,
  AuditRecord,
  CalendarPlanItem,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import { routePlatformApi, type PlatformApiBackend } from "../../src/platform-api.js";

function baseBackend(): PlatformApiBackend {
  return {
    async installRealEstatePack() {
      return { packId: "pack.real-estate", workerIds: [] };
    },
    async listWorkers() {
      return [];
    },
    async submitWorkerTask(input) {
      return {
        workerId: input.workerId,
        taskId: input.taskId,
        status: "completed",
        completedAt: new Date().toISOString()
      };
    },
    async getTaskResult() {
      return undefined;
    },
    async listApprovals(): Promise<ApprovalRequest[]> {
      return [];
    },
    async listAudit(): Promise<AuditRecord[]> {
      return [];
    },
    async decideApproval(input) {
      throw new Error(`unused approval ${input.approvalId}`);
    }
  };
}

function item(status: CalendarPlanItem["status"]): CalendarPlanItem {
  return {
    id: "item-1",
    orgId: "org-1",
    date: "2026-08-11",
    title: "Underwrite opportunity",
    status,
    workerId: "worker-1",
    taskId: "task-1",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  };
}

describe("platform API plan item execution", () => {
  it("executes a plan item through the optional planning backend", async () => {
    let observed: unknown;
    const backend: PlatformApiBackend = {
      ...baseBackend(),
      async executePlanItem(input) {
        observed = input;
        const taskResult: WorkerTaskResult = {
          workerId: "worker-1",
          taskId: "task-1",
          status: "completed",
          output: { ok: true },
          completedAt: "2026-08-11T00:01:00.000Z"
        };
        return { item: item("completed"), taskResult };
      }
    };

    const result = await routePlatformApi(
      {
        requestId: "execute-plan-1",
        path: "/v1/orgs/org-1/plans/2026-08-11/items/item-1/execute",
        method: "POST",
        body: {
          taskType: "commercial_investment_workflow",
          taskInput: { address: "100 Market St, Phoenix, AZ" },
          actionKind: "read"
        }
      },
      backend
    );

    expect(result).toMatchObject({
      matched: true,
      status: 200,
      data: {
        item: { id: "item-1", status: "completed" },
        taskResult: { taskId: "task-1", status: "completed" }
      }
    });
    expect(observed).toMatchObject({
      orgId: "org-1",
      itemId: "item-1",
      taskType: "commercial_investment_workflow",
      actionKind: "read"
    });
  });

  it("returns 202 when plan execution is blocked for approval", async () => {
    const backend: PlatformApiBackend = {
      ...baseBackend(),
      async executePlanItem() {
        return {
          item: item("blocked"),
          taskResult: {
            workerId: "worker-1",
            taskId: "task-1",
            status: "blocked",
            output: { approvalId: "approval-1" },
            error: {
              code: "approval_required",
              message: "Human approval required",
              retryable: false
            },
            completedAt: "2026-08-11T00:01:00.000Z"
          }
        };
      }
    };

    const result = await routePlatformApi(
      {
        requestId: "execute-plan-2",
        path: "/v1/orgs/org-1/plans/2026-08-11/items/item-1/execute",
        method: "POST",
        body: { taskType: "crm.write", actionKind: "write", taskInput: {} }
      },
      backend
    );

    expect(result).toMatchObject({ matched: true, status: 202 });
  });

  it("validates execution input and planning availability", async () => {
    const missingTaskType = await routePlatformApi(
      {
        requestId: "execute-plan-3",
        path: "/v1/orgs/org-1/plans/2026-08-11/items/item-1/execute",
        method: "POST",
        body: {}
      },
      { ...baseBackend(), async executePlanItem() { throw new Error("must not run"); } }
    );
    expect(missingTaskType).toMatchObject({
      matched: true,
      status: 400,
      error: { code: "INVALID_PLAN_EXECUTION" }
    });

    const unavailable = await routePlatformApi(
      {
        requestId: "execute-plan-4",
        path: "/v1/orgs/org-1/plans/2026-08-11/items/item-1/execute",
        method: "POST",
        body: { taskType: "analysis" }
      },
      baseBackend()
    );
    expect(unavailable).toMatchObject({
      matched: true,
      status: 501,
      error: { code: "PLANNING_BACKEND_NOT_AVAILABLE" }
    });
  });
});
