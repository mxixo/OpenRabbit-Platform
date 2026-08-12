export type SimulatedEventKind =
  | "task_completed"
  | "task_skipped"
  | "task_ran_long"
  | "calendar_changed"
  | "blocked"
  | "recovered"
  | "protected_time_observed"
  | "protected_time_challenged"
  | "user_pace_changed";

export interface SimulatedLivingAgendaEvent {
  at: string;
  kind: SimulatedEventKind;
  planItemId?: string;
  minutes?: number;
  detail?: string;
}

export interface SimulatedLivingAgendaDay {
  date: string;
  plannedMinutes: number;
  /** Protected time that was scheduled/intended for the day. */
  protectedMinutes: number;
  events: SimulatedLivingAgendaEvent[];
}

export interface SimulatedLivingAgendaWeek {
  id: string;
  userId: string;
  days: SimulatedLivingAgendaDay[];
}

export interface SimulatedWeekMetrics {
  plannedMinutes: number;
  completedMinutes: number;
  skippedTasks: number;
  interruptions: number;
  recoveries: number;
  /** Total protected time that was scheduled, whether or not it was actually preserved. */
  scheduledProtectedMinutes: number;
  /** Protected time with affirmative observation/evidence that it occurred. */
  observedProtectedMinutes: number;
  protectedTimeChallenges: number;
  /** Backward-compatible alias for observedProtectedMinutes. */
  protectedTimePreserved: number;
  protectedTimeOverridden: number;
  overrunMinutes: number;
  paceIncreaseRequests: number;
  paceDecreaseRequests: number;
  completionRatio: number;
}

export interface SimulatedWeekResult {
  weekId: string;
  metrics: SimulatedWeekMetrics;
  observations: string[];
  failures: string[];
}
