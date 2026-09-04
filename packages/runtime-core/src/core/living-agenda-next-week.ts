import type {
  LivingAgendaNextWeekPlanner,
  NextWeekPlanProposal,
  NextWeekProposalInput,
} from "../interfaces/living-agenda-next-week.js";
import { isProposalConfirmed } from "../interfaces/living-agenda-next-week.js";

const REDUCED_CAPACITY_FACTOR = 0.85;

export class DefaultLivingAgendaNextWeekPlanner implements LivingAgendaNextWeekPlanner {
  propose(input: NextWeekProposalInput): NextWeekPlanProposal {
    const confirmed = input.confirmedProposalIds ?? [];
    let flexibleCapacityMinutes = input.baselineFlexibleCapacityMinutes;
    let protectedMinutes = input.baselineProtectedMinutes;
    let pace: "back_off" | "steady" | "push_harder" = "steady";
    const appliedProposalIds: string[] = [];
    const pendingProposalIds: string[] = [];
    const explanation: string[] = [];
    const notes: string[] = [];

    for (const proposal of input.recalibration.proposals) {
      if (!isProposalConfirmed(proposal, confirmed)) {
        pendingProposalIds.push(proposal.id);
        continue;
      }

      appliedProposalIds.push(proposal.id);
      explanation.push(proposal.rationale);

      if (proposal.id === "reduce-capacity") {
        flexibleCapacityMinutes = Math.max(
          0,
          Math.round(input.baselineFlexibleCapacityMinutes * REDUCED_CAPACITY_FACTOR),
        );
        pace = "back_off";
        notes.push("Flexible capacity reduced by 15% for the proposed week.");
      }

      if (proposal.id === "shift-strategic-work") {
        notes.push("Place strategic flexible work in the strongest observed execution window.");
      }

      if (proposal.id === "review-skips") {
        notes.push("Do not silently carry repeatedly skipped work forward; review it first.");
      }
    }

    if (input.recalibration.summary.protectedMinutes > protectedMinutes) {
      protectedMinutes = input.recalibration.summary.protectedMinutes;
      notes.push("Preserve at least the amount of protected time successfully maintained last week.");
    }

    if (pendingProposalIds.length > 0) {
      explanation.push("One or more recalibration changes are pending user confirmation, so they were not applied automatically.");
    }

    return {
      sourceWeekStart: input.recalibration.summary.weekStart,
      proposed: {
        flexibleCapacityMinutes,
        protectedMinutes,
        pace,
        notes,
      },
      appliedProposalIds,
      pendingProposalIds,
      requiresUserConfirmation: pendingProposalIds.length > 0,
      explanation,
    };
  }
}
