import type {
  GuardianContext,
  GuardianEvaluation,
  GuardianPolicy
} from "../interfaces/guardian.js";

function normalized(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function hasRecentStrongIdentity(context: GuardianContext): boolean {
  return context.identitySignals.some(
    (signal) =>
      (signal.kind === "recent_reauthentication" ||
        signal.kind === "platform_biometric") &&
      Number.isFinite(signal.confidence) &&
      signal.confidence >= 0.8
  );
}

export class FailClosedGuardianPolicy implements GuardianPolicy {
  evaluate(context: GuardianContext): GuardianEvaluation {
    if (!context.orgId?.trim() || !context.userId?.trim() || !context.action?.trim()) {
      return {
        decision: "block_and_alert",
        reasons: ["guardian_context_incomplete"],
        missingCapabilities: []
      };
    }

    const required = normalized(context.requiredCapabilities ?? []);
    const granted = normalized(context.grantedCapabilities ?? []);
    const missingCapabilities = Array.from(required).filter(
      (capability) => !granted.has(capability)
    );

    if (context.anomalyIndicators?.length) {
      return {
        decision: "block_and_alert",
        reasons: ["anomaly_detected", ...context.anomalyIndicators],
        missingCapabilities
      };
    }

    if (missingCapabilities.length) {
      return {
        decision: "block_and_alert",
        reasons: ["missing_required_capability"],
        missingCapabilities
      };
    }

    if (context.externalWrite && context.providerAuthorized === false) {
      return {
        decision: "block_and_alert",
        reasons: ["provider_execution_not_authorized"],
        missingCapabilities: []
      };
    }

    // Unknown provider authorization may only reach the reversible-only lane when
    // reversibility has itself been affirmatively established. This prevents a
    // low-risk label from becoming an accidental bypass for an irreversible side
    // effect through a provider/path whose agent authorization is not known.
    if (
      context.externalWrite &&
      context.providerAuthorized === undefined &&
      context.reversible !== true
    ) {
      return {
        decision: "block_and_alert",
        reasons: ["provider_authorization_unknown_irreversible_write_blocked"],
        missingCapabilities: []
      };
    }

    if (context.risk === "high" && !hasRecentStrongIdentity(context)) {
      return {
        decision: "require_reauthentication",
        reasons: ["high_risk_requires_strong_recent_identity"],
        missingCapabilities: []
      };
    }

    if (context.risk === "high" && (context.externalWrite || context.externallyVisible)) {
      return {
        decision: "require_confirmation",
        reasons: ["high_risk_external_effect_requires_confirmation"],
        missingCapabilities: []
      };
    }

    if (
      context.risk === "moderate" &&
      (context.externalWrite || context.externallyVisible) &&
      context.reversible !== true
    ) {
      return {
        decision: "require_confirmation",
        reasons: ["moderate_irreversible_external_effect_requires_confirmation"],
        missingCapabilities: []
      };
    }

    if (context.externalWrite && context.providerAuthorized === undefined) {
      return {
        decision: "allow_reversible_only",
        reasons: ["provider_authorization_unknown_limit_to_reversible_actions"],
        missingCapabilities: []
      };
    }

    return {
      decision: "allow",
      reasons: ["guardian_checks_passed"],
      missingCapabilities: []
    };
  }
}
