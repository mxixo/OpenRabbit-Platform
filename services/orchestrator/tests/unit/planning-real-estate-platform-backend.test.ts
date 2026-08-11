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
