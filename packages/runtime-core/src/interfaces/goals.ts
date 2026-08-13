export type GoalScope = "personal" | "organization" | "department";
export type GoalStatus = "active" | "paused" | "achieved" | "abandoned";

export interface GoalOutcome {
  id: string;
  label: string;
  target?: number;
  current?: number;
  unit?: string;
  dueAt?: string;
}

export interface LivingAgendaGoal {
  id: string;
  orgId: string;
  scope: GoalScope;
  ownerId?: string;
  departmentId?: string;
  title: string;
  description?: string;
  status: GoalStatus;
  weight: number;
  targetDate?: string;
  outcomes?: GoalOutcome[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanItemGoalLink {
  goalId: string;
  contribution: number;
  rationale?: string;
}

export interface PriorityFactors {
  goalAlignment: number;
  urgency: number;
  impact: number;
  dependencyPressure: number;
  commitmentPressure: number;
  effortFit: number;
  staleness: number;
}

export interface ExplainablePriorityScore {
  score: number;
  factors: PriorityFactors;
  reasons: string[];
}
