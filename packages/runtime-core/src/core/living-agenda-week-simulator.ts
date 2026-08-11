import type {
  SimulatedLivingAgendaWeek,
  SimulatedWeekResult,
} from "../interfaces/living-agenda-simulation.js";

export function simulateLivingAgendaWeek(week: SimulatedLivingAgendaWeek): SimulatedWeekResult {
  let plannedMinutes = 0;
  let completedMinutes = 0;
  let skippedTasks = 0;
  let interruptions = 0;
  let recoveries = 0;
  let protectedTimeChallenges = 0;
  let protectedTimePreserved = 0;
  let protectedTimeOverridden = 0;
  let overrunMinutes = 0;
  let paceIncreaseRequests = 0;
  let paceDecreaseRequests = 0;

  for (const day of week.days) {
    plannedMinutes += day.plannedMinutes;
    protectedTimePreserved += day.protectedMinutes;

    for (const event of day.events) {
      switch (event.kind) {
        case "task_completed":
          completedMinutes += event.minutes ?? 0;
          break;
        case "task_skipped":
          skippedTasks += 1;
          break;
        case "task_ran_long":
          overrunMinutes += event.minutes ?? 0;
          break;
        case "calendar_changed":
        case "blocked":
          interruptions += 1;
          break;
        case "recovered":
          recoveries += 1;
          break;
        case "protected_time_challenged": {
          protectedTimeChallenges += 1;
          if (event.detail === "overridden") {
            const overridden = event.minutes ?? 0;
            protectedTimeOverridden += overridden;
            protectedTimePreserved = Math.max(0, protectedTimePreserved - overridden);
          }
          break;
        }
        case "user_pace_changed":
          if (event.detail === "push_harder") paceIncreaseRequests += 1;
          if (event.detail === "back_off_today") paceDecreaseRequests += 1;
          break;
      }
    }
  }

  const completionRatio = plannedMinutes === 0 ? 1 : Math.min(1, completedMinutes / plannedMinutes);
  const observations: string[] = [];
  const failures: string[] = [];

  if (completionRatio < 0.6) {
    observations.push("Planned workload appears materially above completed capacity.");
  }
  if (interruptions > 0 && recoveries === 0) {
    observations.push("Disruptions occurred without a recorded return to intentional execution.");
  }
  if (overrunMinutes > 60) {
    observations.push("Task duration estimates produced more than one hour of cumulative overrun.");
  }
  if (protectedTimeChallenges > 0 && protectedTimePreserved > 0) {
    observations.push("Protected time was challenged; preservation should be reviewed explicitly rather than silently refilled.");
  }
  if (paceIncreaseRequests > 0 && paceDecreaseRequests > 0) {
    observations.push("The user changed desired pace in both directions; recent explicit context should outrank a permanent productivity label.");
  }
  if (protectedTimeOverridden > 0) {
    observations.push("Some protected time was explicitly overridden and should remain visible in review rather than being normalized as ordinary capacity.");
  }

  return {
    weekId: week.id,
    metrics: {
      plannedMinutes,
      completedMinutes,
      skippedTasks,
      interruptions,
      recoveries,
      protectedTimeChallenges,
      protectedTimePreserved,
      protectedTimeOverridden,
      overrunMinutes,
      paceIncreaseRequests,
      paceDecreaseRequests,
      completionRatio,
    },
    observations,
    failures,
  };
}
