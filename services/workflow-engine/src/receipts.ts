import type { PolicyClass } from "./policy.js";

export interface ProvenanceRef {
  sourceType: "connector" | "file" | "memory" | "user-input" | "derived";
  sourceId: string;
  provider?: string;
  connectionId?: string;
  observedAt?: string;
  purpose?: string;
}

export interface ActionReceipt {
  receiptId: string;
  correlationId: string;
  organizationId: string;
  userId: string;
  capability: string;
  operation: string;
  connectionId?: string;
  resource?: string;
  modelProvider?: string;
  modelId?: string;
  runtime?: string;
  policyClass: PolicyClass;
  policyReason: string;
  requestedAt: string;
  executedAt?: string;
  completedAt?: string;
  status: "requested" | "approved" | "executed" | "verified" | "blocked" | "failed";
  providerReceipt?: string;
  idempotencyKey?: string;
  provenance: ProvenanceRef[];
  error?: string;
}

export interface ActionReceiptValidation {
  valid: boolean;
  errors: string[];
}

const CREDENTIAL_PATTERN = /bearer\s|api[_-]?key|client[_-]?secret|password|token=/i;

function requiredText(value: string | undefined, field: string, errors: string[]): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) errors.push(`${field} is required`);
  if (normalized.length > 4096) errors.push(`${field} is too long`);
  if (CREDENTIAL_PATTERN.test(normalized)) errors.push(`${field} contains credential-like material`);
  return normalized;
}

function parseTimestamp(value: string | undefined, field: string, errors: string[]): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    errors.push(`${field} must be a valid timestamp`);
    return undefined;
  }
  return timestamp;
}

/**
 * Validate the integrity of an action receipt before it is persisted or exposed
 * as audit evidence. This validates receipt consistency, not provider truth.
 * Provider verification remains a separate adapter/control-plane responsibility.
 */
export function validateActionReceipt(receipt: ActionReceipt): ActionReceiptValidation {
  const errors: string[] = [];

  requiredText(receipt.receiptId, "receiptId", errors);
  requiredText(receipt.correlationId, "correlationId", errors);
  requiredText(receipt.organizationId, "organizationId", errors);
  requiredText(receipt.userId, "userId", errors);
  requiredText(receipt.capability, "capability", errors);
  requiredText(receipt.operation, "operation", errors);
  requiredText(receipt.policyReason, "policyReason", errors);

  for (const [field, value] of [
    ["connectionId", receipt.connectionId],
    ["resource", receipt.resource],
    ["modelProvider", receipt.modelProvider],
    ["modelId", receipt.modelId],
    ["runtime", receipt.runtime],
    ["providerReceipt", receipt.providerReceipt],
    ["idempotencyKey", receipt.idempotencyKey],
    ["error", receipt.error]
  ] as const) {
    if (value !== undefined) requiredText(value, field, errors);
  }

  const requested = parseTimestamp(receipt.requestedAt, "requestedAt", errors);
  const executed = parseTimestamp(receipt.executedAt, "executedAt", errors);
  const completed = parseTimestamp(receipt.completedAt, "completedAt", errors);
  if (requested !== undefined && executed !== undefined && executed < requested) {
    errors.push("executedAt cannot precede requestedAt");
  }
  if (executed !== undefined && completed !== undefined && completed < executed) {
    errors.push("completedAt cannot precede executedAt");
  }
  if (requested !== undefined && completed !== undefined && completed < requested) {
    errors.push("completedAt cannot precede requestedAt");
  }

  if ((receipt.status === "executed" || receipt.status === "verified") && !receipt.executedAt) {
    errors.push(`${receipt.status} receipt requires executedAt`);
  }
  if (receipt.status === "verified" && !receipt.completedAt) {
    errors.push("verified receipt requires completedAt");
  }
  if (receipt.status === "verified" && !receipt.providerReceipt) {
    errors.push("verified receipt requires providerReceipt");
  }
  if (receipt.status === "blocked" && receipt.policyClass !== "BLOCK" && receipt.policyClass !== "RED") {
    errors.push("blocked receipt must have BLOCK or RED policyClass");
  }
  if (receipt.policyClass === "BLOCK" && receipt.status !== "blocked") {
    errors.push("BLOCK policyClass must produce blocked receipt status");
  }
  if (receipt.status === "failed" && !receipt.error) {
    errors.push("failed receipt requires error");
  }
  if (receipt.status !== "failed" && receipt.error) {
    errors.push("error is only allowed on failed receipts");
  }

  const provenanceKeys = new Set<string>();
  for (const [index, ref] of receipt.provenance.entries()) {
    const prefix = `provenance[${index}]`;
    const sourceId = requiredText(ref.sourceId, `${prefix}.sourceId`, errors);
    if (ref.provider !== undefined) requiredText(ref.provider, `${prefix}.provider`, errors);
    if (ref.connectionId !== undefined) requiredText(ref.connectionId, `${prefix}.connectionId`, errors);
    if (ref.purpose !== undefined) requiredText(ref.purpose, `${prefix}.purpose`, errors);
    parseTimestamp(ref.observedAt, `${prefix}.observedAt`, errors);

    const key = JSON.stringify([
      ref.sourceType,
      sourceId,
      ref.provider?.trim() ?? "",
      ref.connectionId?.trim() ?? ""
    ]);
    if (provenanceKeys.has(key)) errors.push(`${prefix} duplicates an earlier provenance reference`);
    provenanceKeys.add(key);
  }

  return { valid: errors.length === 0, errors };
}

export function explainProvenance(receipt: ActionReceipt): string[] {
  return receipt.provenance.map(
    (p) => p.sourceType + ":" + p.sourceId + (p.provider ? " via " + p.provider : "")
  );
}
