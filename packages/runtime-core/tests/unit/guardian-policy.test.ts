import { describe, expect, it } from "vitest";
import { FailClosedGuardianPolicy } from "../../src/core/fail-closed-guardian-policy.js";
import type { GuardianContext } from "../../src/interfaces/guardian.js";

function context(overrides: Partial<GuardianContext> = {}): GuardianContext {
  return {
    orgId: "org-1",
    userId: "user-1",
    action: "calendar.create_event",
    risk: "low",
    requiredCapabilities: ["calendar.write"],
    grantedCapabilities: ["calendar.write"],
    identitySignals: [],
    externallyVisible: false,
    externalWrite: false,
    reversible: true,
    ...overrides
  };
}

describe("FailClosedGuardianPolicy", () => {
  it("blocks missing capability authority before execution", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(
      context({ grantedCapabilities: ["calendar.read"] })
    );

    expect(result.decision).toBe("block_and_alert");
    expect(result.missingCapabilities).toEqual(["calendar.write"]);
  });

  it("blocks explicitly unauthorized provider execution", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(
      context({ externalWrite: true, providerAuthorized: false })
    );

    expect(result.decision).toBe("block_and_alert");
    expect(result.reasons).toContain("provider_execution_not_authorized");
  });

  it("blocks irreversible external writes when provider authorization is unknown", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(
      context({
        risk: "low",
        externalWrite: true,
        providerAuthorized: undefined,
        reversible: false
      })
    );

    expect(result.decision).toBe("block_and_alert");
    expect(result.reasons).toContain(
      "provider_authorization_unknown_irreversible_write_blocked"
    );
  });

  it("requires fresh strong identity for high-risk actions", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(context({ risk: "high", externalWrite: true }));

    expect(result.decision).toBe("require_reauthentication");
  });

  it("requires confirmation after high-risk identity is re-established", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(
      context({
        risk: "high",
        externalWrite: true,
        providerAuthorized: true,
        identitySignals: [
          {
            kind: "recent_reauthentication",
            confidence: 0.99,
            observedAt: "2026-09-22T16:00:00Z"
          }
        ]
      })
    );

    expect(result.decision).toBe("require_confirmation");
  });

  it("limits external writes to reversible behavior when provider authorization is unknown", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(
      context({ externalWrite: true, reversible: true })
    );

    expect(result.decision).toBe("allow_reversible_only");
  });

  it("blocks anomalous requests even when capabilities are present", () => {
    const policy = new FailClosedGuardianPolicy();
    const result = policy.evaluate(
      context({ anomalyIndicators: ["command_origin_changed"] })
    );

    expect(result.decision).toBe("block_and_alert");
    expect(result.reasons).toContain("command_origin_changed");
  });
});
