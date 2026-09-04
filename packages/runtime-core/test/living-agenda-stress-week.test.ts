import { describe, expect, it } from "vitest";
import { simulateAndRecalibrate } from "../src/core/living-agenda-simulation-review.js";
import { contradictoryStressWeek } from "./fixtures/living-agenda-stress-week.js";

describe("Living Agenda contradictory stress week", () => {
  it("preserves explicit pace changes without collapsing them into a fixed personality", () => {
    const result = simulateAndRecalibrate(contradictoryStressWeek);
    expect(result.simulation.metrics.paceIncreaseRequests).toBe(1);
    expect(result.simulation.metrics.paceDecreaseRequests).toBe(1);
    expect(result.simulation.observations).toContain(
      "The user changed desired pace in both directions; recent explicit context should outrank a permanent productivity label.",
    );
  });

  it("keeps protected life time visible through a disrupted ambitious week", () => {
    const result = simulateAndRecalibrate(contradictoryStressWeek);
    expect(result.simulation.metrics.protectedTimeChallenges).toBe(5);
    expect(result.simulation.metrics.protectedTimeOverridden).toBe(0);
    expect(result.simulation.metrics.protectedTimePreserved).toBe(1350);
  });

  it("recognizes disruption and recovery together", () => {
    const result = simulateAndRecalibrate(contradictoryStressWeek);
    expect(result.simulation.metrics.interruptions).toBe(2);
    expect(result.simulation.metrics.recoveries).toBe(2);
  });

  it("surfaces unrealistic aggregate load without treating one bad day as identity", () => {
    const result = simulateAndRecalibrate(contradictoryStressWeek);
    expect(result.simulation.metrics.overrunMinutes).toBe(135);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(true);
    expect(result.recalibration.proposals.every((proposal) => proposal.requiresUserConfirmation)).toBe(true);
  });
});
