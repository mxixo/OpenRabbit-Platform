import { describe, expect, it } from "vitest";
import { LivingAgendaTrustEvaluator } from "../../src/core/living-agenda-trust-evaluator.js";

describe("LivingAgendaTrustEvaluator", () => {
  const evaluator = new LivingAgendaTrustEvaluator();

  it("allows low-risk reversible actions with a trusted session", () => {
    const result = evaluator.evaluate({
      userId: "user-1",
      action: "complete-task",
      risk: "low",
      reversible: true,
      identitySignals: [
        { kind: "device_session", confidence: 0.9, observedAt: "2026-08-11T06:00:00Z" }
      ]
    });
    expect(result.decision).toBe("allow");
  });

  it("requires reauthentication for high-risk actions without a strong auth anchor", () => {
    const result = evaluator.evaluate({
      userId: "user-1",
      action: "export-private-history",
      risk: "high",
      identitySignals: [
        { kind: "voice_match", confidence: 0.95, observedAt: "2026-08-11T06:00:00Z" },
        { kind: "device_session", confidence: 0.8, observedAt: "2026-08-11T06:00:00Z" }
      ]
    });
    expect(result.decision).toBe("require_reauthentication");
  });

  it("allows high-risk actions when strong biometric authentication is present", () => {
    const result = evaluator.evaluate({
      userId: "user-1",
      action: "change-security-settings",
      risk: "high",
      identitySignals: [
        { kind: "platform_biometric", confidence: 0.98, observedAt: "2026-08-11T06:00:00Z" },
        { kind: "device_session", confidence: 0.9, observedAt: "2026-08-11T06:00:00Z" }
      ]
    });
    expect(result.decision).toBe("allow");
  });

  it("blocks and alerts on high-risk activity with multiple anomalies", () => {
    const result = evaluator.evaluate({
      userId: "user-1",
      action: "delete-all-goals",
      risk: "high",
      identitySignals: [
        { kind: "device_session", confidence: 0.6, observedAt: "2026-08-11T06:00:00Z" }
      ],
      anomalyIndicators: ["unfamiliar_voice", "bulk_change", "unusual_time"]
    });
    expect(result.decision).toBe("block_and_alert");
  });
});
