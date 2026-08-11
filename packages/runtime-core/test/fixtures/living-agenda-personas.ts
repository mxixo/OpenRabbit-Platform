import type { SimulatedLivingAgendaWeek } from "../../src/interfaces/living-agenda-simulation.js";

export const ambitiousAcceleratorWeek: SimulatedLivingAgendaWeek = {
  id: "accelerator-week",
  userId: "accelerator",
  days: [
    { date: "2026-08-10", plannedMinutes: 300, protectedMinutes: 90, events: [
      { at: "2026-08-10T10:00:00-07:00", kind: "task_completed", minutes: 150 },
      { at: "2026-08-10T15:00:00-07:00", kind: "task_completed", minutes: 120 },
    ] },
    { date: "2026-08-11", plannedMinutes: 300, protectedMinutes: 90, events: [
      { at: "2026-08-11T11:00:00-07:00", kind: "task_completed", minutes: 160 },
      { at: "2026-08-11T16:00:00-07:00", kind: "task_completed", minutes: 125 },
    ] },
    { date: "2026-08-12", plannedMinutes: 300, protectedMinutes: 90, events: [
      { at: "2026-08-12T12:00:00-07:00", kind: "calendar_changed" },
      { at: "2026-08-12T12:20:00-07:00", kind: "recovered" },
      { at: "2026-08-12T17:00:00-07:00", kind: "task_completed", minutes: 260 },
    ] },
  ],
};

export const timeReclaimerWeek: SimulatedLivingAgendaWeek = {
  id: "time-reclaimer-week",
  userId: "time-reclaimer",
  days: [
    { date: "2026-08-10", plannedMinutes: 360, protectedMinutes: 180, events: [
      { at: "2026-08-10T12:00:00-07:00", kind: "task_completed", minutes: 180 },
      { at: "2026-08-10T17:00:00-07:00", kind: "protected_time_challenged", minutes: 120, detail: "preserved" },
    ] },
    { date: "2026-08-11", plannedMinutes: 360, protectedMinutes: 180, events: [
      { at: "2026-08-11T12:00:00-07:00", kind: "task_completed", minutes: 190 },
      { at: "2026-08-11T15:00:00-07:00", kind: "task_ran_long", minutes: 45 },
      { at: "2026-08-11T17:00:00-07:00", kind: "protected_time_challenged", minutes: 90, detail: "preserved" },
    ] },
    { date: "2026-08-12", plannedMinutes: 360, protectedMinutes: 180, events: [
      { at: "2026-08-12T12:00:00-07:00", kind: "task_completed", minutes: 175 },
      { at: "2026-08-12T16:00:00-07:00", kind: "task_skipped" },
    ] },
  ],
};

export const consistencyBuilderWeek: SimulatedLivingAgendaWeek = {
  id: "consistency-builder-week",
  userId: "consistency-builder",
  days: [
    { date: "2026-08-10", plannedMinutes: 180, protectedMinutes: 120, events: [
      { at: "2026-08-10T11:00:00-07:00", kind: "task_completed", minutes: 90 },
      { at: "2026-08-10T14:00:00-07:00", kind: "task_skipped" },
    ] },
    { date: "2026-08-11", plannedMinutes: 180, protectedMinutes: 120, events: [
      { at: "2026-08-11T10:00:00-07:00", kind: "blocked" },
      { at: "2026-08-11T13:00:00-07:00", kind: "recovered" },
      { at: "2026-08-11T15:00:00-07:00", kind: "task_completed", minutes: 80 },
    ] },
    { date: "2026-08-12", plannedMinutes: 180, protectedMinutes: 120, events: [
      { at: "2026-08-12T11:00:00-07:00", kind: "task_completed", minutes: 95 },
      { at: "2026-08-12T15:00:00-07:00", kind: "task_skipped" },
    ] },
  ],
};
