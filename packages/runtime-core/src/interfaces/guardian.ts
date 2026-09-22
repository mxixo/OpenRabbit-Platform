import type {
  ActionRiskTier,
  IdentitySignal,
  TrustDecision
} from "./trust.js";

export interface GuardianContext {
  orgId: string;
  userId: string;
  action: string;
  risk: ActionRiskTier;
  requiredCapabilities: string[];
  grantedCapabilities: string[];
  identitySignals: IdentitySignal[];
  anomalyIndicators?: string[];
  externallyVisible?: boolean;
  externalWrite?: boolean;
  reversible?: boolean;
  providerAuthorized?: boolean;
}

export interface GuardianEvaluation {
  decision: TrustDecision;
  reasons: string[];
  missingCapabilities: string[];
}

export interface GuardianPolicy {
  evaluate(context: GuardianContext): GuardianEvaluation;
}
