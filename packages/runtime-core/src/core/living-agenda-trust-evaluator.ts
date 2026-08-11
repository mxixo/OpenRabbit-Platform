import type {
  IdentitySignal,
  TrustContext,
  TrustDecision,
  TrustEvaluation,
  TrustEvaluator
} from "../interfaces/trust.js";

const WEIGHTS: Record<IdentitySignal["kind"], number> = {
  platform_biometric: 1,
  recent_reauthentication: 0.95,
  device_session: 0.8,
  trusted_wearable: 0.7,
  trusted_device: 0.65,
  voice_match: 0.55,
  behavioral_consistency: 0.25
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function weightedConfidence(signals: IdentitySignal[]): number {
  if (!signals.length) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const signal of signals) {
    const weight = WEIGHTS[signal.kind];
    weighted += clamp(signal.confidence) * weight;
    totalWeight += weight;
  }
  return totalWeight ? clamp(weighted / totalWeight) : 0;
}

function strongest(context: TrustContext, kind: IdentitySignal["kind"]): number {
  return Math.max(
    0,
    ...context.identitySignals
      .filter((signal) => signal.kind === kind)
      .map((signal) => clamp(signal.confidence))
  );
}

export class LivingAgendaTrustEvaluator implements TrustEvaluator {
  evaluate(context: TrustContext): TrustEvaluation {
    const base = weightedConfidence(context.identitySignals);
    const anomalyCount = context.anomalyIndicators?.length ?? 0;
    const anomalyPenalty = Math.min(0.45, anomalyCount * 0.15);
    const confidence = clamp(base - anomalyPenalty);

    const biometric = strongest(context, "platform_biometric");
    const reauth = strongest(context, "recent_reauthentication");
    const deviceSession = strongest(context, "device_session");
    const voice = strongest(context, "voice_match");
    const reasons: string[] = [];

    if (!context.identitySignals.length) reasons.push("no identity signals available");
    if (biometric >= 0.8) reasons.push("strong platform biometric signal");
    if (reauth >= 0.8) reasons.push("recent strong reauthentication");
    if (deviceSession >= 0.7) reasons.push("trusted active device session");
    if (voice >= 0.75) reasons.push("voice matched enrolled profile");
    if (anomalyCount) reasons.push(`${anomalyCount} anomaly indicator${anomalyCount === 1 ? "" : "s"}`);

    let decision: TrustDecision;

    if (anomalyCount >= 3 && context.risk === "high") {
      decision = "block_and_alert";
      reasons.push("high-risk action combined with multiple anomalies");
    } else if (context.risk === "high") {
      if (biometric >= 0.8 || reauth >= 0.85) {
        decision = confidence >= 0.65 ? "allow" : "require_confirmation";
      } else {
        decision = "require_reauthentication";
        reasons.push("high-risk action requires strong authentication anchor");
      }
    } else if (context.risk === "moderate") {
      if (confidence >= 0.72 && anomalyCount === 0) {
        decision = "allow";
      } else if (confidence >= 0.48 && context.reversible !== false) {
        decision = "allow_reversible_only";
        reasons.push("moderate confidence; restrict to reversible changes");
      } else {
        decision = "require_confirmation";
        reasons.push("moderate-risk action needs explicit confirmation");
      }
    } else {
      if (anomalyCount >= 2 && confidence < 0.45) {
        decision = "require_confirmation";
        reasons.push("low-risk action still has meaningful anomaly uncertainty");
      } else if (confidence >= 0.35 || context.reversible !== false) {
        decision = "allow";
      } else {
        decision = "allow_reversible_only";
      }
    }

    if (context.externallyVisible && decision === "allow" && confidence < 0.7) {
      decision = "require_confirmation";
      reasons.push("externally visible action needs stronger assurance");
    }

    if (!reasons.length) reasons.push("trust policy satisfied");

    return { decision, confidence, reasons };
  }
}
