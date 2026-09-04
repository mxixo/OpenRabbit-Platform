import { describe, expect, it } from "vitest";
import { InMemoryCalendarPlanStore } from "../../src/core/in-memory-calendar-plan-store.js";

describe("InMemoryCalendarPlanStore", () => {
  it("keeps calendar items tenant-scoped and filterable", () => {
    const store = new InMemoryCalendarPlanStore();
    store.createItem({
      id: "item-1",
      orgId: "org-1",
      date: "2026-08-11",
      title: "Review acquisitions pipeline",
      status: "planned",
      workerId: "worker-acquisitions"
    });
    store.createItem({
      id: "item-2",
      orgId: "org-2",
      date: "2026-08-11",
      title: "Other org task",
      status: "planned"
    });

    expect(store.listItems("org-1")).toHaveLength(1);
    expect(store.listItems("org-1", { date: "2026-08-11" })).toHaveLength(1);
    expect(store.listItems("org-1", { workerId: "worker-acquisitions" })).toHaveLength(1);
    expect(store.listItems("org-1", { status: "completed" })).toHaveLength(0);
  });

  it("updates status and preserves source metadata", () => {
    const store = new InMemoryCalendarPlanStore();
    store.createItem({
      id: "item-1",
      orgId: "org-1",
      date: "2026-08-11",
      title: "Call broker",
      status: "planned",
      source: {
        provider: "google-calendar",
        calendarId: "primary",
        eventId: "event-1"
      },
      metadata: { origin: "calendar" }
    });

    const updated = store.updateItem("org-1", "item-1", {
      status: "completed",
      notes: "Spoke with broker"
    });

    expect(updated.status).toBe("completed");
    expect(updated.source?.eventId).toBe("event-1");
    expect(updated.metadata?.origin).toBe("calendar");
    expect(updated.notes).toBe("Spoke with broker");
  });

  it("saves one daily plan per org and date without leaking item arrays", () => {
    const store = new InMemoryCalendarPlanStore();
    const created = store.saveDailyPlan({
      id: "plan-1",
      orgId: "org-1",
      date: "2026-08-11",
      timezone: "America/Phoenix",
      objective: "Move the highest-value work forward",
      itemIds: ["item-1", "item-2"],
      generatedBy: "openrabbit"
    });

    created.itemIds.push("mutated");
    expect(store.getDailyPlan("org-1", "2026-08-11")?.itemIds).toEqual([
      "item-1",
      "item-2"
    ]);

    const replaced = store.saveDailyPlan({
      id: "plan-1-revision",
      orgId: "org-1",
      date: "2026-08-11",
      timezone: "America/Phoenix",
      itemIds: ["item-2"]
    });
    expect(replaced.itemIds).toEqual(["item-2"]);
    expect(store.getDailyPlan("org-2", "2026-08-11")).toBeUndefined();
  });
});
