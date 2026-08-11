import type { SimulatedLivingAgendaWeek, SimulatedWeekResult } from "../interfaces/living-agenda-simulation.js";
import type { WeeklyExecutionSummary, WeeklyRecalibration } from "../interfaces/living-agenda-weekly-review.js";
import { simulateLivingAgendaWeek } from "./living-agenda-week-simulator.js";
import { buildWeeklyRecalibration } from "./living-agenda-weekly-review.js";

export interface SimulatedRecalibrationResult {
  simulation: SimulatedWeekResult;
  recalibration: WeeklyRecalibration;
}

export function simulationToWeeklySummary(
  week: SimulatedLivingAgendaWeek,
  simulation: SimulatedWeekResult,
): WeeklyExecutionSummary {
  return {
    weekStart: week.days[0]?.date ?? "unknown",
    plannedMinutes: simulation.metrics.plannedMinutes,
    completedMinutes: simulation.metrics.completedMinutes,
    protectedMinutes: simulation.metrics.protectedTimePreserved,
    deferredCount: 0,
    skippedCount: simulation.metrics.skippedTasks,
    blockedCount: week.days.flatMap((day) => day.events).filter((event) => event.kind === "blocked").length,
    recoveryEvents: simulation.metrics.recoveries,
  };
}

export function simulateAndRecalibrate(week: SimulatedLivingAgendaWeek): SimulatedRecalibrationResult {
  const simulation = simulateLivingAgendaWeek(week);
  const summary = simulationToWeeklySummary(week, simulation);
  return {
    simulation,
    recalibration: buildWeeklyRecalibration(summary),
  };
}
