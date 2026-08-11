import { describe, expect, it } from "vitest";
import { PlanningRealEstatePlatformBackend } from "../../src/planning-real-estate-platform-backend.js";

describe("PlanningRealEstatePlatformBackend", () => {
  it("creates plan items and persists a daily operating plan", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const item = await backend.createPlanItem({
      orgId: "org-1",
      date: "2026-08-11",
      title: "Review acquisitions pipeline",
      priority: 1,
      workerId: "real-estate.acquisitions.org-1",
      source: {
        provider: "google-calendar",
        calendarId: "primary",
        eventId: "event-1"
      }
    });

    const plan = await backend.saveDailyPlan({
      orgId: "org-1",
      date: "2026-08-11",
      timezone: "America/Phoenix",
      objective: "Move the highest-value work forward",
      itemIds: [item.id],
      generatedBy: "openrabbit"
    });

    expect(plan.itemIds).toEqual([item.id]);
    expect(await backend.getDailyPlan("org-1", "2026-08-11")).toEqual(plan);
    expect(await backend.listPlanItems("org-1", "2026-08-11")).toEqual([
      expect.objectContaining({
        id: item.id,
        title: "Review acquisitions pipeline",
        status: "planned"
      })
    ]);
  });

  it("tracks execution status and notes on a plan item", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const item = await backend.createPlanItem({
      orgId: "org-1",
      date: "2026-08-11",
      title: "Underwrite opportunity"
    });

    const inProgress = await backend.updatePlanItem({
      orgId: "org-1",
      itemId: item.id,
      status: "in_progress",
      taskId: "task-1"
    });
    expect(inProgress.status).toBe("in_progress");
    expect(inProgress.taskId).toBe("task-1");

    const completed = await backend.updatePlanItem({
      orgId: "org-1",
      itemId: item.id,
      status: "completed",
      notes: "Analysis delivered"
    });
    expect(completed.status).toBe("completed");
    expect(completed.notes).toBe("Analysis delivered");
  });

  it("executes an assigned read task and automatically completes the plan item", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-exec-1");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const item = await backend.createPlanItem({
      orgId: "org-exec-1",
      date: "2026-08-11",
      title: "Underwrite 100 Market St",
      workerId: acquisitionsWorkerId,
      notes: "Priority acquisition review"
    });

    const execution = await backend.executePlanItem({
      orgId: "org-exec-1",
      itemId: item.id,
      taskType: "commercial_investment_workflow",
      actionKind: "read",
      taskInput: {
        address: "100 Market St, Phoenix, AZ",
        purchasePrice: 1200000,
        annualGrossIncome: 165000
      }
    });

    expect(execution.taskResult.status).toBe("completed");
    expect(execution.item.status).toBe("completed");
    expect(execution.item.taskId).toMatch(/^plan-task-/);
    expect(execution.item.notes).toContain("Priority acquisition review");
    expect(execution.item.notes).toContain("completed");
    expect(execution.item.metadata).toMatchObject({
      executionTaskType: "commercial_investment_workflow",
      executionActionKind: "read",
      executionStatus: "completed"
    });

    await backend.stopOrg("org-exec-1");
  });

  it("blocks an assigned write task and records the approval on the plan item", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-exec-2");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const item = await backend.createPlanItem({
      orgId: "org-exec-2",
      date: "2026-08-11",
      title: "Prepare consequential acquisition action",
      workerId: acquisitionsWorkerId
    });

    const execution = await backend.executePlanItem({
      orgId: "org-exec-2",
      itemId: item.id,
      taskType: "commercial_investment_workflow",
      actionKind: "write",
      taskInput: { address: "100 Market St, Phoenix, AZ" }
    });

    expect(execution.taskResult.status).toBe("blocked");
    expect(execution.taskResult.error?.code).toBe("approval_required");
    expect(execution.item.status).toBe("blocked");
    expect(execution.item.notes).toContain("pending human approval");
    expect(execution.item.metadata?.approvalId).toBeTruthy();

    await backend.stopOrg("org-exec-2");
  });

  it("rejects execution when a plan item has no assigned worker", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const item = await backend.createPlanItem({
      orgId: "org-exec-3",
      date: "2026-08-11",
      title: "Unassigned work"
    });

    await expect(
      backend.executePlanItem({
        orgId: "org-exec-3",
        itemId: item.id,
        taskType: "commercial_investment_workflow",
        taskInput: { address: "100 Market St, Phoenix, AZ" }
      })
    ).rejects.toThrow("has no assigned worker");
  });

  it("keeps planning state isolated by organization", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    await backend.createPlanItem({
      orgId: "org-1",
      date: "2026-08-11",
      title: "Org one task"
    });

    expect(await backend.listPlanItems("org-2", "2026-08-11")).toEqual([]);
    expect(await backend.getDailyPlan("org-2", "2026-08-11")).toBeUndefined();
  });
});
