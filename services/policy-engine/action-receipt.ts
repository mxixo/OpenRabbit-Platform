import type { PolicyDecision } from "./policy";

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
  provenance: Array<{ sourceType:string; sourceId:string; permission:string }>;
  requestedAt: string;
  executedAt?: string;
  verifiedAt?: string;
  providerReceiptId?: string;
  idempotencyKey: string;
  status: "proposed"|"executed"|"verified"|"failed"|"blocked";
  error?: string;
}
