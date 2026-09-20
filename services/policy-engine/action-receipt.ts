import type { PolicyDecision } from "./policy";

export interface TargetIdentity {
  orgId?: string;
  connectionId?: string;
  accountId?: string;
  resourceId?: string;
  domain?: string;
  environment?: string;
}

export interface TargetVerification {
  verifier: "connector-gateway" | "browser-guard" | "broker-adapter" | "platform-runtime";
  expected: TargetIdentity;
  observed: TargetIdentity;
  requiredDimensions: string[];
  ambiguous?: boolean;
  valid: boolean;
  reason: string;
}

export interface ActionReceipt {
  receiptId: string;
  orgId: string;
  userId: string;
  workflowId?: string;
  capability: string;
  operation: string;
  connectionId?: string;
  modelProvider?: string;
  modelVersion?: string;
  runtime?: string;
  policy: PolicyDecision;
  targetVerification?: TargetVerification;
  provenance: Array<{ sourceType:string; sourceId:string; permission:string }>;
  requestedAt: string;
  executedAt?: string;
  verifiedAt?: string;
  providerReceiptId?: string;
  idempotencyKey: string;
  status: "proposed"|"executed"|"verified"|"failed"|"blocked";
  error?: string;
}
