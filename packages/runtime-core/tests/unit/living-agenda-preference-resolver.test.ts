import { describe, expect, it } from "vitest";
import { resolveLivingAgendaPreference } from "../../src/core/living-agenda-preference-resolver.js";
import type { LivingAgendaPreference } from "../../src/interfaces/living-agenda-preferences.js";

function preference(overrides: Partial<LivingAgendaPreference>): LivingAgendaPreference {
  return {
    id: "pref-1",
    userId: "user-1",
    key: "protected_time",
    value: "default",
    provenance: "ai_inferred",
    strength: "soft",
    confidence: 0.5,
    observedAt: "2026-08-10T12:00:00.000Z",
    ...overrides
  };
}

describe("resolveLivingAgendaPreference", () => {
  it("preserves an explicit hard boundary over a conflicting inference", () => {
    const result = resolveLivingAgendaPreference([
      preference({ id: "inferred", value: "work_sunday", confidence: 0.95 }),
      preference({
        id: "explicit",
        value: "protect_sunday",
        provenance: "user_explicit",
        strength: "hard_boundary",
        confidence: 1
      })
    ]);

    expect(result.effective?.id).toBe("explicit");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("asks before overriding when strong user preferences conflict", () => {
    const result = resolveLivingAgendaPreference([
      preference({
        id: "older",
        value: "no_work_after_18",
        provenance: "user_explicit",
        strength: "hard_boundary",
        confidence: 1,
        observedAt: "2026-08-01T12:00:00.000Z"
      }),
      preference({
        id: "newer",
        value: "work_until_20_this_week",
        provenance: "user_confirmed",
        strength: "strong",
        confidence: 1,
        observedAt: "2026-08-10T12:00:00.000Z"
      })
    ]);

    expect(result.effective?.id).toBe("older");
    expect(result.requiresConfirmation).toBe(true);
  });

  it("ignores expired preferences", () => {
    const result = resolveLivingAgendaPreference(
      [
        preference({ id: "expired", value: "temporary_push", expiresAt: "2026-08-09T00:00:00.000Z" }),
        preference({ id: "active", value: "normal_pace", observedAt: "2026-08-10T00:00:00.000Z" })
      ],
      "2026-08-10T23:00:00.000Z"
    );

    expect(result.effective?.id).toBe("active");
  });
});
