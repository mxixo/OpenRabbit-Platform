import { describe, expect, it } from "vitest";
import type {
  ApprovalRequest,
  AuditRecord,
  CalendarPlanItem,
  DailyPlan,
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
      } satisfies WorkerTaskResult;
    },
    async getTaskResult() {
      return undefined;
    },
    async listApprovals() {
      return [] as ApprovalRequest[];
    },
    async listAudit() {
      return [] as AuditRecord[];
    },
    async decideApproval() {
      throw new Error("not used");
    }
  };
}

describe("platform API daily planning routes", () => {
  it("returns a normalized daily plan and its items", async () => {
    const plan: DailyPlan = {
      id: "plan-1",
      orgId: "org-1",
      date: "2026-08-11",
      timezone: "America/Phoenix",
      itemIds: ["item-1"],
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z"
    };
    const items: CalendarPlanItem[] = [
      {
        id: "item-1",
        orgId: "org-1",
        date: "2026-08-11",
        title: "Review acquisitions pipeline",
        status: "planned",
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z"
      }
    ];
    const backend: PlatformApiBackend = {
      ...baseBackend(),
      async getDailyPlan() {
        return plan;
      },
      async listPlanItems() {
        return items;
      }
    };

    const planResult = await routePlatformApi(
      {
        requestId: "plan-get-1",
        method: "GET",
        path: "/v1/orgs/org-1/plans/2026-08-11"
      },
      backend
    );
    expect(planResult).toMatchObject({ matched: true, status: 200, data: plan });

    const itemResult = await routePlatformApi(
      {
        requestId: "plan-items-1",
        method: "GET",
        path: "/v1/orgs/org-1/plans/2026-08-11/items"
      },
      backend
    );
    expect(itemResult).toMatchObject({ matched: true, status: 200, data: items });
  });

  it("validates and saves a daily plan", async () => {
    let observed: unknown;
    const backend: PlatformApiBackend = {
      ...baseBackend(),
      async saveDailyPlan(input) {
        observed = input;
        return {
          id: "plan-1",
          ...input,
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z"
        };
      }
    };

    const result = await routePlatformApi(
      {
        requestId: "plan-put-1",
        method: "PUT",
        path: "/v1/orgs/org-1/plans/2026-08-11",
        body: {
          timezone: "America/Phoenix",
          objective: "Move priority work forward",
          itemIds: ["item-1"],
          generatedBy: "openrabbit"
        }
      },
      backend
    );

    expect(result.matched).toBe(true);
    expect(result.status).toBe(200);
    expect(observed).toEqual({
      orgId: "org-1",
      date: "2026-08-11",
      timezone: "America/Phoenix",
      objective: "Move priority work forward",
      itemIds: ["item-1"],
      generatedBy: "openrabbit"
    });
  });

  it("returns an explicit unavailable error until a planning backend is composed", async () => {
    const result = await routePlatformApi(
      {
        requestId: "plan-missing-1",
        method: "GET",
        path: "/v1/orgs/org-1/plans/2026-08-11"
      },
      baseBackend()
    );

    expect(result).toMatchObject({
      matched: true,
      status: 501,
      error: { code: "PLANNING_BACKEND_NOT_AVAILABLE" }
    });
  });
});
