import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  JsonFileCalendarPlanStore,
  type CalendarPlanStoreSnapshot
} from "../../src/index.js";

function temporaryStorePath(): string {
  return join(mkdtempSync(join(tmpdir(), "openrabbit-calendar-")), "plans.json");
}

describe("JsonFileCalendarPlanStore", () => {
  it("recovers plan items, execution notes, and daily plans after restart", () => {
    const filePath = temporaryStorePath();
    const first = new JsonFileCalendarPlanStore({ filePath });
    const item = first.createItem({
      id: "item-1",
      orgId: "org-1",
      date: "2026-08-13",
      title: "Review buyer outreach",
      status: "planned",
      workerId: "worker-1"
    });
    first.updateItem("org-1", item.id, {
      status: "blocked",
      taskId: "task-1",
      notes: "Waiting for human approval",
      metadata: { approvalId: "approval-1" }
    });
    first.saveDailyPlan({
      id: "plan-1",
      orgId: "org-1",
      date: "2026-08-13",
      timezone: "America/Phoenix",
      objective: "Advance qualified opportunities",
      itemIds: [item.id],
      generatedBy: "openrabbit"
    });

    const restarted = new JsonFileCalendarPlanStore({ filePath });
    expect(restarted.getItem("org-1", item.id)).toMatchObject({
      status: "blocked",
      taskId: "task-1",
      notes: "Waiting for human approval",
      metadata: { approvalId: "approval-1" }
    });
    expect(restarted.getDailyPlan("org-1", "2026-08-13")).toMatchObject({
      objective: "Advance qualified opportunities",
      itemIds: [item.id]
    });
  });

  it("exports and imports a portable versioned backup", () => {
    const source = new JsonFileCalendarPlanStore({ filePath: temporaryStorePath() });
    source.createItem({
      id: "item-backup",
      orgId: "org-backup",
      date: "2026-08-13",
      title: "Portable task",
      status: "completed",
      notes: "Persisted result"
    });
    const backup = source.exportSnapshot("2026-08-13T12:00:00.000Z");

    const destinationPath = temporaryStorePath();
    const destination = new JsonFileCalendarPlanStore({ filePath: destinationPath });
    destination.importSnapshot(backup);
    const restored = new JsonFileCalendarPlanStore({ filePath: destinationPath });

    expect(restored.getItem("org-backup", "item-backup")).toMatchObject({
      status: "completed",
      notes: "Persisted result"
    });
    expect(JSON.parse(readFileSync(destinationPath, "utf8"))).toMatchObject({
      version: 1,
      items: [expect.objectContaining({ id: "item-backup" })]
    });
  });

  it("rejects invalid backups without replacing existing state", () => {
    const filePath = temporaryStorePath();
    const store = new JsonFileCalendarPlanStore({ filePath });
    store.createItem({
      id: "safe-item",
      orgId: "org-1",
      date: "2026-08-13",
      title: "Keep me",
      status: "planned"
    });

    expect(() =>
      store.importSnapshot({
        version: 2,
        exportedAt: new Date().toISOString(),
        items: [],
        plans: []
      } as unknown as CalendarPlanStoreSnapshot)
    ).toThrow("Unsupported calendar plan snapshot version");

    expect(new JsonFileCalendarPlanStore({ filePath }).getItem("org-1", "safe-item"))
      .toMatchObject({ title: "Keep me" });
  });

  it("keeps organization data isolated after recovery", () => {
    const filePath = temporaryStorePath();
    const store = new JsonFileCalendarPlanStore({ filePath });
    store.createItem({
      id: "private-item",
      orgId: "org-private",
      date: "2026-08-13",
      title: "Private",
      status: "planned"
    });

    const restarted = new JsonFileCalendarPlanStore({ filePath });
    expect(restarted.listItems("org-other")).toEqual([]);
    expect(restarted.getItem("org-other", "private-item")).toBeUndefined();
  });
});
