import type { SimulatedLivingAgendaWeek } from "../../src/interfaces/living-agenda-simulation.js";

/**
 * A deliberately messy week. The purpose is to make the planner face the
 * contradictions real people create: ambition, disruption, recovery,
 * protected time, and explicit changes in desired pace.
 */
export const contradictoryStressWeek: SimulatedLivingAgendaWeek = {
  id: "contradictory-stress-week",
  userId: "stress-persona",
  days: [
    {
      date: "2026-08-10",
      plannedMinutes: 300,
      protectedMinutes: 120,
      events: [
        { at: "2026-08-10T10:00:00-07:00", kind: "task_completed", minutes: 140, detail: "strong start" },
        { at: "2026-08-10T14:00:00-07:00", kind: "task_ran_long", minutes: 60, detail: "analysis took twice the estimate" },
        { at: "2026-08-10T17:30:00-07:00", kind: "protected_time_challenged", minutes: 90, detail: "preserved" },
      ],
    },
    {
      date: "2026-08-11",
      plannedMinutes: 330,
      protectedMinutes: 90,
      events: [
        { at: "2026-08-11T09:15:00-07:00", kind: "calendar_changed", detail: "meeting moved into focus block" },
        { at: "2026-08-11T11:30:00-07:00", kind: "blocked", detail: "waiting on collaborator" },
        { at: "2026-08-11T14:00:00-07:00", kind: "recovered", detail: "switched to another eligible task" },
        { at: "2026-08-11T16:30:00-07:00", kind: "task_completed", minutes: 210 },
      ],
    },
    {
      date: "2026-08-12",
      plannedMinutes: 360,
      protectedMinutes: 120,
      events: [
        { at: "2026-08-12T08:00:00-07:00", kind: "user_pace_changed", detail: "push_harder" },
        { at: "2026-08-12T12:00:00-07:00", kind: "task_completed", minutes: 180 },
        { at: "2026-08-12T16:00:00-07:00", kind: "task_completed", minutes: 150 },
      ],
    },
    {
      date: "2026-08-13",
      plannedMinutes: 360,
      protectedMinutes: 120,
      events: [
        { at: "2026-08-13T09:00:00-07:00", kind: "task_skipped", detail: "bad morning" },
        { at: "2026-08-13T11:00:00-07:00", kind: "task_ran_long", minutes: 75, detail: "unexpected research" },
        { at: "2026-08-13T13:00:00-07:00", kind: "user_pace_changed", detail: "back_off_today" },
        { at: "2026-08-13T18:00:00-07:00", kind: "protected_time_challenged", minutes: 120, detail: "preserved" },
      ],
    },
    {
      date: "2026-08-14",
      plannedMinutes: 240,
      protectedMinutes: 180,
      events: [
        { at: "2026-08-14T09:30:00-07:00", kind: "recovered", detail: "returned after reduced Thursday" },
        { at: "2026-08-14T12:00:00-07:00", kind: "task_completed", minutes: 195 },
        { at: "2026-08-14T17:00:00-07:00", kind: "protected_time_challenged", minutes: 120, detail: "preserved" },
      ],
    },
    {
      date: "2026-08-15",
      plannedMinutes: 120,
      protectedMinutes: 300,
      events: [
        { at: "2026-08-15T10:00:00-07:00", kind: "task_completed", minutes: 90 },
        { at: "2026-08-15T13:00:00-07:00", kind: "protected_time_challenged", minutes: 180, detail: "preserved" },
      ],
    },
    {
      date: "2026-08-16",
      plannedMinutes: 60,
      protectedMinutes: 420,
      events: [
        { at: "2026-08-16T09:00:00-07:00", kind: "task_skipped", detail: "optional admin intentionally deferred" },
        { at: "2026-08-16T10:00:00-07:00", kind: "protected_time_challenged", minutes: 240, detail: "preserved" },
      ],
    },
  ],
};
