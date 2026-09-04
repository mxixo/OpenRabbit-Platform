export interface WeeklyExecutionSummary {
  weekStart: string;
  plannedMinutes: number;
  completedMinutes: number;
  protectedMinutes: number;
  deferredCount: number;
  skippedCount: number;
  blockedCount: number;
  recoveryEvents: number;
  byTimeOfDay?: Record<string, { planned: number; completed: number }>;
  byCategory?: Record<string, { planned: number; completed: number }>;
}

export interface WeeklyPattern {
  id: string;
  kind: "capacity" | "timing" | "drift" | "recovery" | "overcommitment" | "efficiency";
  observation: string;
  confidence: number;
  evidence: string[];
}

export interface RecalibrationProposal {
  id: string;
  kind: "capacity" | "timing" | "preference" | "planning";
  proposal: string;
  rationale: string;
  requiresUserConfirmation: boolean;
}

export interface WeeklyRecalibration {
  summary: WeeklyExecutionSummary;
  patterns: WeeklyPattern[];
  proposals: RecalibrationProposal[];
  reflectionPrompts: string[];
}
