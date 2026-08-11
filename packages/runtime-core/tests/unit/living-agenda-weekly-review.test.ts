import { describe, expect, it } from "vitest";
import { buildWeeklyRecalibration } from "../../src/core/living-agenda-weekly-review.js";

describe("buildWeeklyRecalibration", () => {
  it("detects overcommitment and proposes reducing flexible capacity", () => {
    const review = buildWeeklyRecalibration({
      weekStart: "2026-08-10",
      plannedMinutes: 1000,
      completedMinutes: 500,
      protectedMinutes: 300,
      deferredCount: 4,
      skippedCount: 1,
      blockedCount: 1,
      recoveryEvents: 2
    });

    expect(review.patterns.some((pattern) => pattern.kind === "overcommitment")).toBe(true);
    expect(review.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(true);
  });

  it("surfaces timing differences without silently rewriting preferences", () => {
    const review = buildWeeklyRecalibration({
      weekStart: "2026-08-10",
      plannedMinutes: 600,
      completedMinutes: 500,
      protectedMinutes: 240,
      deferredCount: 1,
      skippedCount: 0,
      blockedCount: 0,
      recoveryEvents: 1,
      byTimeOfDay: {
        morning: { planned: 300, completed: 270 },
        evening: { planned: 300, completed: 120 }
      }
    });

    const timingProposal = review.proposals.find((proposal) => proposal.kind === "timing");
    expect(timingProposal?.requiresUserConfirmation).toBe(true);
    expect(timingProposal?.proposal).toContain("morning");
  });

  it("flags repeated skips as a decision point", () => {
    const review = buildWeeklyRecalibration({
      weekStart: "2026-08-10",
      plannedMinutes: 600,
      completedMinutes: 500,
      protectedMinutes: 240,
      deferredCount: 1,
      skippedCount: 4,
      blockedCount: 0,
      recoveryEvents: 1
    });

    expect(review.patterns.some((pattern) => pattern.kind === "drift")).toBe(true);
    expect(review.proposals.some((proposal) => proposal.id === "review-skips")).toBe(true);
  });
});
