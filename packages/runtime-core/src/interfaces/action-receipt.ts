import type { ActionRiskTier, TrustDecision } from "./trust.js";

export type ActionActorType =
  | "user"
  | "worker"
  | "tool"
  | "system"
  | "human_delegate";

export type ActionCommandOrigin =
  | "user_input"
  | "voice"
  | "automation"
  | "agent_delegation"
  | "provider_callback"
  | "human_delegate";

export type ActionExecutionMode =
  | "native_api"
  | "mcp"
  | "browser"
  | "local_runtime"
  | "human";

export type ActionEffectStatus =
  | "none"
  | "attempted"
  | "confirmed"
  | "reconciled"
  | "failed"
  | "unknown";

export interface ActionReceiptProvenance {
  actorType: ActionActorType;
  commandOrigin: ActionCommandOrigin;
  actorId?: string;
  workerId?: string;
  deviceId?: string;
  parentReceiptId?: string;
  delegationChain?: string[];
}

export interface ActionReceiptPolicyEvidence {
  guardianDecision: TrustDecision;
  policyVersion: string;
  risk: ActionRiskTier;
  requiredCapabilities: string[];
  capabilitySnapshotId?: string;
  approvalId?: string;
}

export interface ActionReceiptProviderEvidence {
  provider: string;
  executionMode: ActionExecutionMode;
  integrationId?: string;
  providerAuthorized?: boolean;
  requestId?: string;
  externalReceiptId?: string;
  observedAt?: string;
}

export interface ActionReceipt {
  id: string;
  orgId: string;
  action: string;
  createdAt: string;
  userId?: string;
  taskId?: string;
  provenance: ActionReceiptProvenance;
  policy: ActionReceiptPolicyEvidence;
  provider?: ActionReceiptProviderEvidence;
  contextCategories?: string[];
  externallyVisible: boolean;
  reversible?: boolean;
  effectStatus: ActionEffectStatus;
  inputHash?: string;
  outputHash?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionReceiptFilter {
  taskId?: string;
  workerId?: string;
  action?: string;
  effectStatus?: ActionEffectStatus;
}

export interface ActionReceiptStore {
  append(
    input: Omit<ActionReceipt, "createdAt"> & { createdAt?: string }
  ): ActionReceipt;
  get(orgId: string, id: string): ActionReceipt | undefined;
  list(orgId: string, filter?: ActionReceiptFilter): ActionReceipt[];
}
