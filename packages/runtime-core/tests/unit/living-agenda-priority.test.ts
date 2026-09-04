import { describe, expect, it } from "vitest";
import { scoreLivingAgendaPriority } from "../../src/core/living-agenda-priority.js";

describe("scoreLivingAgendaPriority", () => {
  it("prioritizes goal alignment and impact while preserving an explanation", () => {
    const score = scoreLivingAgendaPriority({
      goalAlignment: 100,
      urgency: 80,
      impact: 95,
      dependencyPressure: 30,
      commitmentPressure: 60,
      effortFit: 70,
      staleness: 20
    });

    expect(score.score).toBeGreaterThan(70);
    expect(score.reasons).toContain("goalAlignment: 100/100");
    expect(score.reasons).toContain("impact: 95/100");
  });

  it("does not let urgency alone dominate strategic work", () => {
    const urgentNoise = scoreLivingAgendaPriority({ urgency: 100, impact: 20, goalAlignment: 5 });
    const strategicWork = scoreLivingAgendaPriority({ urgency: 40, impact: 95, goalAlignment: 100 });

    expect(strategicWork.score).toBeGreaterThan(urgentNoise.score);
  });

  it("clamps malformed factor values", () => {
    const score = scoreLivingAgendaPriority({ goalAlignment: 150, urgency: -20 });
    expect(score.factors.goalAlignment).toBe(100);
    expect(score.factors.urgency).toBe(0);
  });
});
