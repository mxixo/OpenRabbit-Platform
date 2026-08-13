import { describe, expect, it } from "vitest";
import { generateLivingAgenda } from "../../src/core/living-agenda-generator.js";
import type { CalendarPlanItem } from "../../src/interfaces/calendar.js";

function item(id: string, title: string): CalendarPlanItem {
  return {
    id,
    orgId: "org-1",
    date: "2026-08-11",
    title,
    status: "planned",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  };
}

describe("generateLivingAgenda", () => {
  it("protects fixed commitments and fills remaining capacity with strategic work", () => {
    const agenda = generateLivingAgenda({
      date: "2026-08-11",
      availableMinutes: 240,
      candidates: [
        { item: item("meeting", "Client meeting"), estimatedMinutes: 60, fixed: true },
        {
          item: item("strategy", "Build Living Agenda generator"),
          estimatedMinutes: 120,
          priorityFactors: { goalAlignment: 100, impact: 95, urgency: 50 }
        },
        {
          item: item("noise", "Low-value urgent cleanup"),
          estimatedMinutes: 90,
          priorityFactors: { goalAlignment: 10, impact: 20, urgency: 100 }
        }
      ]
    });

    expect(agenda.items.map((entry) => entry.itemId)).toEqual(["meeting", "strategy"]);
    expect(agenda.deferred.map((entry) => entry.itemId)).toEqual(["noise"]);
    expect(agenda.scheduledMinutes).toBe(180);
  });

  it("explains when work does not fit after higher-priority commitments", () => {
    const agenda = generateLivingAgenda({
      date: "2026-08-11",
      availableMinutes: 60,
      candidates: [
        {
          item: item("deep-work", "Deep work"),
          estimatedMinutes: 90,
          priorityFactors: { goalAlignment: 100, impact: 100 }
        }
      ]
    });

    expect(agenda.items).toHaveLength(0);
    expect(agenda.deferred[0]?.reason).toContain("60 available");
  });

  it("does not silently drop fixed commitments when they exceed nominal capacity", () => {
    const agenda = generateLivingAgenda({
      date: "2026-08-11",
      availableMinutes: 60,
      candidates: [
        { item: item("fixed", "Required appointment"), estimatedMinutes: 90, fixed: true }
      ]
    });

    expect(agenda.items[0]?.itemId).toBe("fixed");
    expect(agenda.scheduledMinutes).toBe(90);
  });
});
