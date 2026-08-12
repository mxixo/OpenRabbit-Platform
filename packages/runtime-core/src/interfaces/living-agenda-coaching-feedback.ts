export type CoachingProposalDecision = "accepted" | "rejected";

export interface CoachingProposalFeedback {
  proposalId: string;
  decision: CoachingProposalDecision;
  decidedAt: string;
  reason?: string;
}

export interface CoachingPreferenceSignal {
  id: string;
  kind: "capacity_coaching" | "timing_coaching" | "planning_coaching";
  direction: "more_receptive" | "less_receptive";
  strength: "weak" | "moderate" | "strong";
  sourceProposalIds: string[];
  explanation: string;
  requiresConfirmationBeforePreferenceChange: boolean;
}

export interface CoachingFeedbackSummary {
  feedbackCount: number;
  acceptedCount: number;
  rejectedCount: number;
  signals: CoachingPreferenceSignal[];
}

export interface LivingAgendaCoachingFeedbackAnalyzer {
  analyze(feedback: CoachingProposalFeedback[]): CoachingFeedbackSummary;
}
