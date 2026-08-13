import { describe, expect, it } from "vitest";
import { reconcileLivingAgenda } from "../../src/core/living-agenda-reconciler.js";
import type { CalendarPlanItem } from "../../src/interfaces/calendar.js";

function candidate(id: string, minutes: number, goalAlignment: number) {
  const item: CalendarPlanItem = {
    id,
    orgId: "org-1",
    date: "2026-08-11",
    title: id,
    status: "planned",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  };
  return { item, estimatedMinutes: minutes, priorityFactors: { goalAlignment, impact: goalAlignment } };
}

describe("reconcileLivingAgenda", () => {
  it("removes completed and blocked work then replans remaining capacity", () => {
    const result = reconcileLivingAgenda({
      date: "2026-08-11",
      availableMinutes: 120,
      candidates: [candidate("done", 60, 100), candidate("blocked", 60, 90), candidate("next", 90, 80)],
      changes: [
        { kind: "completed", itemId: "done" },
        { kind: "blocked", itemId: "blocked", detail: "waiting for approval" }
      ]
    });

    expect(result.agenda.items.map((entry) => entry.itemId)).toEqual(["next"]);
    expect(result.coachNotes.join(" ")).toContain("completed");
    expect(result.coachNotes.join(" ")).toContain("blocked");
  });

  it("flags skipped work for an explicit recommit/delegate/deprioritize decision", () => {
    const result = reconcileLivingAgenda({
      date: "2026-08-11",
      availableMinutes: 120,
      candidates: [candidate("skipped", 30, 100), candidate("other", 60, 70)],
      changes: [{ kind: "skipped", itemId: "skipped" }]
    });

    expect(result.agenda.items.map((entry) => entry.itemId)).toEqual(["other"]);
    expect(result.coachNotes.join(" ")).toContain("recommitment, delegation, or deprioritization");
  });
});
