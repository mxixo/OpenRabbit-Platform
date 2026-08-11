export type SimulatedEventKind =
  | "task_completed"
  | "task_skipped"
  | "task_ran_long"
  | "calendar_changed"
  | "blocked"
  | "recovered"
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
  protectedTimeChallenges: number;
  protectedTimePreserved: number;
  overrunMinutes: number;
  completionRatio: number;
}

export interface SimulatedWeekResult {
  weekId: string;
  metrics: SimulatedWeekMetrics;
  observations: string[];
  failures: string[];
}
