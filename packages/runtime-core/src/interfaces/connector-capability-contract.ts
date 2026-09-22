import type { ActionExecutionMode } from "./action-receipt.js";
import type { ActionRiskTier } from "./trust.js";

export type ConnectorSideEffect =
  | "none"
  | "external_read"
  | "external_write"
  | "financial"
  | "security_sensitive";

export type ConnectorProviderPolicy = "allowed" | "restricted" | "unknown";

export type ConnectorCredentialMode =
  | "delegated_oauth"
  | "short_lived_token"
  | "brokered_secret_reference";

export type ConnectorConfirmationMode = "none" | "risk_based" | "always";

/**
 * Machine-readable authority boundary for one provider operation.
 *
 * The contract is deliberately separate from worker prompts and model output.
 * A worker can request an operation, but cannot widen this contract at runtime.
 */
export interface ConnectorCapabilityContract {
  contractVersion: "openrabbit.connector-capability.v1";
  connectorId: string;
  provider: string;
  operation: string;
  risk: ActionRiskTier;
  requiredCapabilities: string[];
  sideEffect: ConnectorSideEffect;
  allowedExecutionModes: ActionExecutionMode[];
  allowedContextCategories: string[];
  credentialMode: ConnectorCredentialMode;
  providerPolicy: ConnectorProviderPolicy;
  tenantIsolationRequired: true;
  accountBindingRequired: boolean;
  rawSecretProjectionAllowed: false;
  idempotencyRequired: boolean;
  providerConfirmationRequired: boolean;
  confirmationMode: ConnectorConfirmationMode;
  reversible: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConnectorCapabilityRequest {
  connectorId: string;
  operation: string;
  executionMode: ActionExecutionMode;
  grantedCapabilities: string[];
  contextCategories?: string[];
  providerAuthorized?: boolean;
  targetAccountBound?: boolean;
  idempotencyKey?: string;
}

export interface ConnectorCapabilityEvaluation {
  allowed: boolean;
  reasons: string[];
  missingCapabilities: string[];
  disallowedContextCategories: string[];
}
