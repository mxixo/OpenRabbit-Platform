import { describe, expect, it } from "vitest";
import { assessDailyCapacity } from "../../src/core/living-agenda-capacity.js";

describe("assessDailyCapacity", () => {
  it("removes fixed, protected, recovery, and reserve time from schedulable capacity", () => {
    const result = assessDailyCapacity({
      dayStartAt: "2026-08-11T08:00:00-07:00",
      dayEndAt: "2026-08-11T20:00:00-07:00",
      reserveMinutes: 60,
      commitments: [
        { id: "meeting", kind: "fixed_commitment", startAt: "2026-08-11T09:00:00-07:00", endAt: "2026-08-11T10:00:00-07:00" },
        { id: "family", kind: "protected", startAt: "2026-08-11T18:00:00-07:00", endAt: "2026-08-11T20:00:00-07:00", refillPolicy: "never_auto_refill" },
        { id: "lunch", kind: "recovery", startAt: "2026-08-11T12:00:00-07:00", endAt: "2026-08-11T12:30:00-07:00" }
      ]
    });

    expect(result.totalWindowMinutes).toBe(720);
    expect(result.schedulableMinutes).toBe(450);
    expect(result.refillableMinutes).toBe(0);
  });

  it("does not invent capacity when protected commitments exceed the day", () => {
    const result = assessDailyCapacity({
      dayStartAt: "2026-08-11T09:00:00-07:00",
      dayEndAt: "2026-08-11T10:00:00-07:00",
      commitments: [
        { id: "protected", kind: "protected", startAt: "2026-08-11T08:30:00-07:00", endAt: "2026-08-11T10:30:00-07:00", refillPolicy: "never_auto_refill" }
      ]
    });

    expect(result.schedulableMinutes).toBe(0);
    expect(result.warnings.join(" ")).toContain("do not create additional work capacity");
  });
});
