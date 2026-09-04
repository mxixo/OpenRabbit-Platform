import { describe, expect, it } from "vitest";
import { resolveLivingAgendaNowState } from "../../src/core/living-agenda-now-state.js";

describe("resolveLivingAgendaNowState", () => {
  it("selects the highest-priority eligible item and preserves life-map explanation", () => {
    const result = resolveLivingAgendaNowState([
      {
        itemId: "admin",
        title: "Inbox cleanup",
        estimatedMinutes: 20,
        priorityScore: 45,
        availableNow: true
      },
      {
        itemId: "strategic",
        title: "Write launch plan",
        estimatedMinutes: 60,
        priorityScore: 91,
        availableNow: true,
        lifeMapPath: {
          nodeIds: ["direction", "goal", "project", "strategic"],
          explanation: ["Supports your goal to launch the business this quarter."]
        },
        reasons: ["High strategic impact"]
      }
    ], "2026-08-11T12:00:00.000Z");

    expect(result.current?.itemId).toBe("strategic");
    expect(result.explanation.join(" ")).toContain("launch the business");
  });

  it("excludes blocked and protected-conflict items even when their score is higher", () => {
    const result = resolveLivingAgendaNowState([
      {
        itemId: "blocked",
        title: "Blocked work",
        estimatedMinutes: 15,
        priorityScore: 100,
        availableNow: true,
        blocked: true
      },
      {
        itemId: "protected",
        title: "Work during protected family time",
        estimatedMinutes: 15,
        priorityScore: 99,
        availableNow: true,
        protectedConflict: true
      },
      {
        itemId: "eligible",
        title: "Eligible work",
        estimatedMinutes: 30,
        priorityScore: 70,
        availableNow: true
      }
    ]);

    expect(result.current?.itemId).toBe("eligible");
  });

  it("returns a calm no-action state when nothing is executable", () => {
    const result = resolveLivingAgendaNowState([
      {
        itemId: "later",
        title: "Later task",
        estimatedMinutes: 30,
        priorityScore: 80,
        availableNow: false
      }
    ]);

    expect(result.current).toBeUndefined();
    expect(result.explanation[0]).toContain("wait, recover, or reconcile");
  });
});
