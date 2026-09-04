import { describe, expect, it } from "vitest";
import { DefaultLivingAgendaCoachingFeedbackAnalyzer } from "../src/core/living-agenda-coaching-feedback.js";

describe("Living Agenda coaching feedback", () => {
  it("does not turn a single decision into a durable preference", () => {
    const analyzer = new DefaultLivingAgendaCoachingFeedbackAnalyzer();
    const result = analyzer.analyze([
      { proposalId: "reduce-capacity", decision: "rejected", decidedAt: "2026-08-11T18:00:00-07:00" },
    ]);

    expect(result.signals).toHaveLength(0);
  });

  it("surfaces repeated acceptance as a confirmable coaching preference signal", () => {
    const analyzer = new DefaultLivingAgendaCoachingFeedbackAnalyzer();
    const result = analyzer.analyze([
      { proposalId: "reduce-capacity", decision: "accepted", decidedAt: "2026-08-01T18:00:00-07:00" },
      { proposalId: "reduce-capacity", decision: "accepted", decidedAt: "2026-08-08T18:00:00-07:00" },
      { proposalId: "capacity-reset", decision: "accepted", decidedAt: "2026-08-15T18:00:00-07:00" },
      { proposalId: "reduce-capacity", decision: "rejected", decidedAt: "2026-08-22T18:00:00-07:00" },
    ]);

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.direction).toBe("more_receptive");
    expect(result.signals[0]?.strength).toBe("moderate");
    expect(result.signals[0]?.requiresConfirmationBeforePreferenceChange).toBe(true);
  });

  it("learns from repeated rejection without silently changing user preferences", () => {
    const analyzer = new DefaultLivingAgendaCoachingFeedbackAnalyzer();
    const result = analyzer.analyze([
      { proposalId: "shift-strategic-work", decision: "rejected", decidedAt: "2026-08-01T18:00:00-07:00" },
      { proposalId: "shift-strategic-work", decision: "rejected", decidedAt: "2026-08-08T18:00:00-07:00" },
      { proposalId: "timing-window", decision: "rejected", decidedAt: "2026-08-15T18:00:00-07:00" },
    ]);

    expect(result.signals[0]?.kind).toBe("timing_coaching");
    expect(result.signals[0]?.direction).toBe("less_receptive");
    expect(result.signals[0]?.requiresConfirmationBeforePreferenceChange).toBe(true);
  });
});
