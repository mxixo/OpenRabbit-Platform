import type {
  CoachingFeedbackSummary,
  CoachingPreferenceSignal,
  CoachingProposalFeedback,
  LivingAgendaCoachingFeedbackAnalyzer,
} from "../interfaces/living-agenda-coaching-feedback.js";

function proposalKind(proposalId: string): CoachingPreferenceSignal["kind"] {
  if (proposalId.includes("capacity")) return "capacity_coaching";
  if (proposalId.includes("shift") || proposalId.includes("timing")) return "timing_coaching";
  return "planning_coaching";
}

export class DefaultLivingAgendaCoachingFeedbackAnalyzer implements LivingAgendaCoachingFeedbackAnalyzer {
  analyze(feedback: CoachingProposalFeedback[]): CoachingFeedbackSummary {
    const acceptedCount = feedback.filter((item) => item.decision === "accepted").length;
    const rejectedCount = feedback.length - acceptedCount;
    const grouped = new Map<CoachingPreferenceSignal["kind"], CoachingProposalFeedback[]>();

    for (const item of feedback) {
      const kind = proposalKind(item.proposalId);
      grouped.set(kind, [...(grouped.get(kind) ?? []), item]);
    }

    const signals: CoachingPreferenceSignal[] = [];
    for (const [kind, items] of grouped) {
      if (items.length < 2) continue;

      const accepted = items.filter((item) => item.decision === "accepted").length;
      const rejected = items.length - accepted;
      const dominant = Math.max(accepted, rejected);
      if (dominant / items.length < 0.75) continue;

      const direction = accepted > rejected ? "more_receptive" : "less_receptive";
      const strength = items.length >= 5 ? "strong" : items.length >= 3 ? "moderate" : "weak";
      signals.push({
        id: `${kind}:${direction}`,
        kind,
        direction,
        strength,
        sourceProposalIds: items.map((item) => item.proposalId),
        explanation:
          direction === "more_receptive"
            ? "The user has repeatedly accepted this class of coaching suggestion."
            : "The user has repeatedly rejected this class of coaching suggestion.",
        requiresConfirmationBeforePreferenceChange: true,
      });
    }

    return {
      feedbackCount: feedback.length,
      acceptedCount,
      rejectedCount,
      signals,
    };
  }
}
