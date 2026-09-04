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
    { date: "2026-08-13", plannedMinutes: 300, protectedMinutes: 90, events: [
      { at: "2026-08-13T11:00:00-07:00", kind: "task_completed", minutes: 145 },
      { at: "2026-08-13T16:00:00-07:00", kind: "task_completed", minutes: 140 },
    ] },
    { date: "2026-08-14", plannedMinutes: 300, protectedMinutes: 90, events: [
      { at: "2026-08-14T10:30:00-07:00", kind: "task_completed", minutes: 150 },
      { at: "2026-08-14T15:30:00-07:00", kind: "task_completed", minutes: 130 },
      { at: "2026-08-14T17:00:00-07:00", kind: "user_pace_changed", detail: "push_harder" },
    ] },
    { date: "2026-08-15", plannedMinutes: 240, protectedMinutes: 150, events: [
      { at: "2026-08-15T12:00:00-07:00", kind: "task_completed", minutes: 225 },
      { at: "2026-08-15T16:00:00-07:00", kind: "protected_time_challenged", minutes: 60, detail: "preserved" },
    ] },
    { date: "2026-08-16", plannedMinutes: 180, protectedMinutes: 240, events: [
      { at: "2026-08-16T11:00:00-07:00", kind: "task_completed", minutes: 170 },
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
    { date: "2026-08-13", plannedMinutes: 360, protectedMinutes: 180, events: [
      { at: "2026-08-13T11:30:00-07:00", kind: "task_completed", minutes: 165 },
      { at: "2026-08-13T14:00:00-07:00", kind: "calendar_changed" },
      { at: "2026-08-13T15:00:00-07:00", kind: "recovered" },
      { at: "2026-08-13T17:00:00-07:00", kind: "protected_time_challenged", minutes: 60, detail: "preserved" },
    ] },
    { date: "2026-08-14", plannedMinutes: 360, protectedMinutes: 180, events: [
      { at: "2026-08-14T12:00:00-07:00", kind: "task_completed", minutes: 170 },
      { at: "2026-08-14T15:30:00-07:00", kind: "task_skipped" },
    ] },
    { date: "2026-08-15", plannedMinutes: 240, protectedMinutes: 240, events: [
      { at: "2026-08-15T11:30:00-07:00", kind: "task_completed", minutes: 120 },
      { at: "2026-08-15T14:00:00-07:00", kind: "protected_time_challenged", minutes: 90, detail: "preserved" },
    ] },
    { date: "2026-08-16", plannedMinutes: 180, protectedMinutes: 300, events: [
      { at: "2026-08-16T11:00:00-07:00", kind: "task_completed", minutes: 75 },
      { at: "2026-08-16T13:00:00-07:00", kind: "user_pace_changed", detail: "back_off_today" },
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
    { date: "2026-08-13", plannedMinutes: 180, protectedMinutes: 120, events: [
      { at: "2026-08-13T10:30:00-07:00", kind: "task_completed", minutes: 85 },
      { at: "2026-08-13T13:00:00-07:00", kind: "task_ran_long", minutes: 30 },
    ] },
    { date: "2026-08-14", plannedMinutes: 180, protectedMinutes: 120, events: [
      { at: "2026-08-14T10:00:00-07:00", kind: "calendar_changed" },
      { at: "2026-08-14T13:00:00-07:00", kind: "task_skipped" },
    ] },
    { date: "2026-08-15", plannedMinutes: 120, protectedMinutes: 180, events: [
      { at: "2026-08-15T11:00:00-07:00", kind: "task_completed", minutes: 70 },
      { at: "2026-08-15T14:00:00-07:00", kind: "protected_time_challenged", minutes: 60, detail: "preserved" },
    ] },
    { date: "2026-08-16", plannedMinutes: 90, protectedMinutes: 240, events: [
      { at: "2026-08-16T11:00:00-07:00", kind: "task_completed", minutes: 55 },
      { at: "2026-08-16T13:00:00-07:00", kind: "user_pace_changed", detail: "back_off_today" },
    ] },
  ],
};
