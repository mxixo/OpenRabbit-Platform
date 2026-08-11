import { describe, expect, it } from "vitest";
import { simulateAndRecalibrate } from "../src/core/living-agenda-simulation-review.js";
import {
  ambitiousAcceleratorWeek,
  consistencyBuilderWeek,
  timeReclaimerWeek,
} from "./fixtures/living-agenda-personas.js";

describe("Living Agenda persona simulations", () => {
  it("does not automatically tell a high-adherence accelerator to reduce capacity", () => {
    const result = simulateAndRecalibrate(ambitiousAcceleratorWeek);
    expect(result.simulation.metrics.completionRatio).toBeGreaterThan(0.85);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(false);
  });

  it("protects a time reclaimer's life boundaries even when planned work is too high", () => {
    const result = simulateAndRecalibrate(timeReclaimerWeek);
    expect(result.simulation.metrics.protectedTimeChallenges).toBe(2);
    expect(result.simulation.metrics.protectedTimePreserved).toBe(540);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(true);
  });

  it("treats inconsistency as a planning signal rather than demanding maximum workload", () => {
    const result = simulateAndRecalibrate(consistencyBuilderWeek);
    expect(result.simulation.metrics.recoveries).toBe(1);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(true);
    expect(result.recalibration.reflectionPrompts).toContain("Is there anything you want me to push harder on or back off from next week?");
  });
});
