import { describe, expect, it } from "vitest";
import { simulateLivingAgendaWeek } from "../src/core/living-agenda-week-simulator.js";

const baseWeek = {
  id: "week-1",
  userId: "user-1",
  days: [
    {
      date: "2026-08-10",
      plannedMinutes: 240,
      protectedMinutes: 120,
      events: [
        { at: "2026-08-10T10:00:00-07:00", kind: "task_completed" as const, minutes: 90 },
        { at: "2026-08-10T12:00:00-07:00", kind: "calendar_changed" as const },
        { at: "2026-08-10T13:00:00-07:00", kind: "recovered" as const },
      ],
    },
  ],
};

describe("simulateLivingAgendaWeek", () => {
  it("reports overcommitment without treating it as a moral failure", () => {
    const result = simulateLivingAgendaWeek(baseWeek);
    expect(result.metrics.completionRatio).toBeLessThan(0.6);
    expect(result.observations).toContain("Planned workload appears materially above completed capacity.");
    expect(result.failures).toEqual([]);
  });

  it("tracks protected-time challenges without automatically refilling the time", () => {
    const result = simulateLivingAgendaWeek({
      ...baseWeek,
      days: [{
        ...baseWeek.days[0],
        events: [
          ...baseWeek.days[0].events,
          { at: "2026-08-10T18:00:00-07:00", kind: "protected_time_challenged", minutes: 60, detail: "preserved" },
        ],
      }],
    });
    expect(result.metrics.protectedTimeChallenges).toBe(1);
    expect(result.metrics.protectedTimePreserved).toBe(120);
  });

  it("records overridden protected time explicitly", () => {
    const result = simulateLivingAgendaWeek({
      ...baseWeek,
      days: [{
        ...baseWeek.days[0],
        events: [{ at: "2026-08-10T18:00:00-07:00", kind: "protected_time_challenged", minutes: 45, detail: "overridden" }],
      }],
    });
    expect(result.metrics.protectedTimePreserved).toBe(75);
  });
});
