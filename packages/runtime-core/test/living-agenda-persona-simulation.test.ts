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
    expect(ambitiousAcceleratorWeek.days).toHaveLength(7);
    expect(result.simulation.metrics.completionRatio).toBeGreaterThan(0.9);
    expect(result.simulation.metrics.recoveries).toBe(1);
    expect(result.simulation.metrics.protectedTimeChallenges).toBe(1);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(false);
  });

  it("protects a time reclaimer's life boundaries even when planned work is too high", () => {
    const result = simulateAndRecalibrate(timeReclaimerWeek);
    expect(timeReclaimerWeek.days).toHaveLength(7);
    expect(result.simulation.metrics.completionRatio).toBeLessThan(0.5);
    expect(result.simulation.metrics.protectedTimeChallenges).toBe(4);
    expect(result.simulation.metrics.protectedTimePreserved).toBe(1440);
    expect(result.simulation.metrics.paceDecreaseRequests).toBe(1);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(true);
  });

  it("treats inconsistency as a planning signal rather than demanding maximum workload", () => {
    const result = simulateAndRecalibrate(consistencyBuilderWeek);
    expect(consistencyBuilderWeek.days).toHaveLength(7);
    expect(result.simulation.metrics.completionRatio).toBeLessThan(0.5);
    expect(result.simulation.metrics.recoveries).toBe(1);
    expect(result.simulation.metrics.skippedTasks).toBe(3);
    expect(result.simulation.metrics.paceDecreaseRequests).toBe(1);
    expect(result.recalibration.proposals.some((proposal) => proposal.id === "reduce-capacity")).toBe(true);
    expect(result.recalibration.reflectionPrompts).toContain("Is there anything you want me to push harder on or back off from next week?");
  });
});
