export type ActionRiskTier = "low" | "moderate" | "high";

export type TrustDecision =
  | "allow"
  | "allow_reversible_only"
  | "require_confirmation"
  | "require_reauthentication"
  | "block_and_alert";

export interface IdentitySignal {
  kind:
    | "device_session"
    | "platform_biometric"
    | "trusted_device"
    | "trusted_wearable"
    | "voice_match"
    | "behavioral_consistency"
    | "recent_reauthentication";
  confidence: number;
  observedAt: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface TrustContext {
  userId: string;
  action: string;
  risk: ActionRiskTier;
  identitySignals: IdentitySignal[];
  anomalyIndicators?: string[];
  reversible?: boolean;
  externallyVisible?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TrustEvaluation {
  decision: TrustDecision;
  confidence: number;
  reasons: string[];
}

export interface TrustEvaluator {
  evaluate(context: TrustContext): TrustEvaluation;
}
