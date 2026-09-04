import { describe, expect, it } from "vitest";
import { DefaultLivingAgendaNextWeekPlanner } from "../src/core/living-agenda-next-week.js";
import { simulateAndRecalibrate } from "../src/core/living-agenda-simulation-review.js";
import {
  ambitiousAcceleratorWeek,
  consistencyBuilderWeek,
  timeReclaimerWeek,
} from "./fixtures/living-agenda-personas.js";

const planner = new DefaultLivingAgendaNextWeekPlanner();

describe("Living Agenda next-week planning", () => {
  it("keeps strong execution steady when no recalibration change is needed", () => {
    const { recalibration } = simulateAndRecalibrate(ambitiousAcceleratorWeek);
    const result = planner.propose({
      recalibration,
      baselineFlexibleCapacityMinutes: 2100,
      baselineProtectedMinutes: 630,
    });

    expect(result.proposed.flexibleCapacityMinutes).toBe(2100);
    expect(result.proposed.pace).toBe("steady");
    expect(result.pendingProposalIds).toHaveLength(0);
  });

  it("does not silently reduce capacity until the user confirms the proposal", () => {
    const { recalibration } = simulateAndRecalibrate(timeReclaimerWeek);
    const pending = planner.propose({
      recalibration,
      baselineFlexibleCapacityMinutes: 2520,
      baselineProtectedMinutes: 1260,
    });

    expect(pending.pendingProposalIds).toContain("reduce-capacity");
    expect(pending.proposed.flexibleCapacityMinutes).toBe(2520);
    expect(pending.requiresUserConfirmation).toBe(true);

    const confirmed = planner.propose({
      recalibration,
      baselineFlexibleCapacityMinutes: 2520,
      baselineProtectedMinutes: 1260,
      confirmedProposalIds: ["reduce-capacity"],
    });

    expect(confirmed.appliedProposalIds).toContain("reduce-capacity");
    expect(confirmed.proposed.flexibleCapacityMinutes).toBe(2142);
    expect(confirmed.proposed.pace).toBe("back_off");
  });

  it("preserves protected time and keeps skipped-work review confirmation-gated", () => {
    const { recalibration } = simulateAndRecalibrate(consistencyBuilderWeek);
    const result = planner.propose({
      recalibration,
      baselineFlexibleCapacityMinutes: 1260,
      baselineProtectedMinutes: 600,
    });

    expect(result.proposed.protectedMinutes).toBeGreaterThanOrEqual(600);
    expect(result.pendingProposalIds).toContain("reduce-capacity");
    if (recalibration.proposals.some((proposal) => proposal.id === "review-skips")) {
      expect(result.pendingProposalIds).toContain("review-skips");
    }
  });
});
