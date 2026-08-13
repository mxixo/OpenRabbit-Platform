export interface LivingAgendaGoalDemand {
  goalId: string;
  title: string;
  requestedMinutes: number;
  minimumMeaningfulMinutes: number;
  priorityWeight: number;
  protectedBoundary?: boolean;
}

export interface LivingAgendaGoalConflictInput {
  availableMinutes: number;
  goals: LivingAgendaGoalDemand[];
}

export type GoalConflictStatus = "feasible" | "tradeoff_required" | "impossible_without_boundary_change";

export interface GoalConflictAssessment {
  status: GoalConflictStatus;
  requestedMinutes: number;
  minimumMeaningfulMinutes: number;
  availableMinutes: number;
  deficitMinutes: number;
  protectedGoalIds: string[];
  explanation: string;
  options: string[];
}

export interface LivingAgendaGoalConflictEvaluator {
  evaluate(input: LivingAgendaGoalConflictInput): GoalConflictAssessment;
}
