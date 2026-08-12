import type { RecalibrationProposal, WeeklyRecalibration } from "./living-agenda-weekly-review.js";

export interface NextWeekOperatingPosture {
  flexibleCapacityMinutes: number;
  protectedMinutes: number;
  pace: "back_off" | "steady" | "push_harder";
  notes: string[];
}

export interface NextWeekPlanProposal {
  sourceWeekStart: string;
  proposed: NextWeekOperatingPosture;
  appliedProposalIds: string[];
  pendingProposalIds: string[];
  requiresUserConfirmation: boolean;
  explanation: string[];
}

export interface NextWeekProposalInput {
  recalibration: WeeklyRecalibration;
  baselineFlexibleCapacityMinutes: number;
  baselineProtectedMinutes: number;
  confirmedProposalIds?: string[];
}

export interface LivingAgendaNextWeekPlanner {
  propose(input: NextWeekProposalInput): NextWeekPlanProposal;
}

export function isProposalConfirmed(
  proposal: RecalibrationProposal,
  confirmedProposalIds: string[] = [],
): boolean {
  return !proposal.requiresUserConfirmation || confirmedProposalIds.includes(proposal.id);
}
