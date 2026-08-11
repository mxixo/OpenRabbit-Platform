import { describe, expect, it } from "vitest";
import { DefaultLivingAgendaGoalConflictEvaluator } from "../src/core/living-agenda-goal-conflict.js";

const evaluator = new DefaultLivingAgendaGoalConflictEvaluator();

const goals = [
  { goalId: "business", title: "Launch business", requestedMinutes: 600, minimumMeaningfulMinutes: 300, priorityWeight: 1 },
  { goalId: "health", title: "Train consistently", requestedMinutes: 300, minimumMeaningfulMinutes: 180, priorityWeight: 0.9 },
  { goalId: "family", title: "Protect family time", requestedMinutes: 360, minimumMeaningfulMinutes: 360, priorityWeight: 1, protectedBoundary: true },
  { goalId: "income", title: "Increase income", requestedMinutes: 360, minimumMeaningfulMinutes: 180, priorityWeight: 0.8 },
];

describe("DefaultLivingAgendaGoalConflictEvaluator", () => {
  it("identifies when all goals can stay active but requested pace must change", () => {
    const result = evaluator.evaluate({ availableMinutes: 1200, goals });
    expect(result.status).toBe("tradeoff_required");
    expect(result.protectedGoalIds).toContain("family");
    expect(result.explanation).toContain("cannot all advance at the requested pace");
  });

  it("admits when scheduling cannot solve the user's combination", () => {
    const result = evaluator.evaluate({ availableMinutes: 800, goals });
    expect(result.status).toBe("impossible_without_boundary_change");
    expect(result.options).toContain("Explicitly revisit a protected boundary; never consume it silently.");
  });

  it("does not invent a tradeoff when requested pace genuinely fits", () => {
    const result = evaluator.evaluate({ availableMinutes: 1800, goals });
    expect(result.status).toBe("feasible");
    expect(result.deficitMinutes).toBe(0);
  });
});
