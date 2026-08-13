import type {
  GoalConflictAssessment,
  LivingAgendaGoalConflictEvaluator,
  LivingAgendaGoalConflictInput,
} from "../interfaces/living-agenda-goal-conflict.js";

export class DefaultLivingAgendaGoalConflictEvaluator implements LivingAgendaGoalConflictEvaluator {
  evaluate(input: LivingAgendaGoalConflictInput): GoalConflictAssessment {
    const requestedMinutes = input.goals.reduce((sum, goal) => sum + goal.requestedMinutes, 0);
    const minimumMeaningfulMinutes = input.goals.reduce((sum, goal) => sum + goal.minimumMeaningfulMinutes, 0);
    const protectedGoalIds = input.goals.filter((goal) => goal.protectedBoundary).map((goal) => goal.goalId);

    if (requestedMinutes <= input.availableMinutes) {
      return {
        status: "feasible",
        requestedMinutes,
        minimumMeaningfulMinutes,
        availableMinutes: input.availableMinutes,
        deficitMinutes: 0,
        protectedGoalIds,
        explanation: "The requested pace fits within currently available capacity.",
        options: [],
      };
    }

    if (minimumMeaningfulMinutes <= input.availableMinutes) {
      return {
        status: "tradeoff_required",
        requestedMinutes,
        minimumMeaningfulMinutes,
        availableMinutes: input.availableMinutes,
        deficitMinutes: requestedMinutes - input.availableMinutes,
        protectedGoalIds,
        explanation: "All goals can remain active, but they cannot all advance at the requested pace within current capacity.",
        options: [
          "Reduce the pace of one or more goals.",
          "Temporarily prioritize the highest-value goal while maintaining minimum meaningful progress on the others.",
          "Increase available capacity only if the user explicitly chooses what to trade for it.",
        ],
      };
    }

    return {
      status: "impossible_without_boundary_change",
      requestedMinutes,
      minimumMeaningfulMinutes,
      availableMinutes: input.availableMinutes,
      deficitMinutes: minimumMeaningfulMinutes - input.availableMinutes,
      protectedGoalIds,
      explanation: "Even minimum meaningful progress on every active goal exceeds available capacity. Scheduling alone cannot solve this combination without pausing a goal, extending a timeline, or explicitly changing a boundary.",
      options: [
        "Pause or defer at least one goal.",
        "Extend one or more goal timelines.",
        "Reduce the definition of minimum meaningful progress with the user's agreement.",
        "Explicitly revisit a protected boundary; never consume it silently.",
      ],
    };
  }
}
