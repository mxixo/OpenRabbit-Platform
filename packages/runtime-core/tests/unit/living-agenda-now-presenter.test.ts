import { describe, expect, it } from "vitest";
import { DefaultLivingAgendaNowPresenter } from "../../src/core/living-agenda-now-presenter.js";
import { resolveLivingAgendaNowState } from "../../src/core/living-agenda-now-state.js";

describe("DefaultLivingAgendaNowPresenter", () => {
  it("maps actionable Now-state candidates into the presentation contract", () => {
    const state = resolveLivingAgendaNowState([
      {
        itemId: "current-item",
        title: "Prepare buyer outreach",
        estimatedMinutes: 45,
        priorityScore: 90,
        availableNow: true,
        reasons: ["Highest-impact eligible action"],
      },
      {
        itemId: "next-item",
        title: "Review deal notes",
        estimatedMinutes: 20,
        priorityScore: 70,
        availableNow: true,
      },
    ], "2026-08-13T08:00:00.000Z");

    const result = new DefaultLivingAgendaNowPresenter().present(state, "lock_screen");

    expect(result.primaryText).toBe("Prepare buyer outreach");
    expect(result.secondaryText).toBe("Next: Review deal notes");
    expect(result.currentPlanItemId).toBe("current-item");
    expect(result.nextPlanItemId).toBe("next-item");
    expect(result.whySummary).toContain("highest-priority eligible item");
    expect(result.actions.map((action) => action.kind)).toEqual([
      "complete",
      "running_late",
      "blocked",
      "why",
    ]);
  });

  it("presents the calm no-action explanation without inventing status fields", () => {
    const state = resolveLivingAgendaNowState([
      {
        itemId: "later",
        title: "Later task",
        estimatedMinutes: 30,
        priorityScore: 80,
        availableNow: false,
      },
    ]);

    const result = new DefaultLivingAgendaNowPresenter().present(state, "watch");

    expect(result.headline).toBe("NOW");
    expect(result.primaryText).toContain("wait, recover, or reconcile");
    expect(result.currentPlanItemId).toBeUndefined();
    expect(result.actions).toEqual([
      { id: "open", kind: "open_app", label: "Open Agenda", requiresAppOpen: true },
    ]);
  });

  it("respects presentation policy overrides", () => {
    const state = resolveLivingAgendaNowState([
      {
        itemId: "current-item",
        title: "Current item",
        estimatedMinutes: 15,
        priorityScore: 80,
        availableNow: true,
      },
    ]);

    const result = new DefaultLivingAgendaNowPresenter().present(state, "widget", {
      maxActions: 2,
      showWhySummary: false,
    });

    expect(result.actions).toHaveLength(2);
    expect(result.whySummary).toBeUndefined();
  });
});
