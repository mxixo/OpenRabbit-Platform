import { describe, expect, it } from "vitest";

import { ActionReceipt, validateActionReceipt } from "../../src/receipts.js";

function receipt(overrides: Partial<ActionReceipt> = {}): ActionReceipt {
  return {
    receiptId: "receipt-1",
    correlationId: "corr-1",
    organizationId: "org-1",
    userId: "user-1",
    capability: "gmail",
    operation: "send",
    connectionId: "gmail-1",
    resource: "message-42",
    policyClass: "GREEN",
    policyReason: "routine delegated authority",
    requestedAt: "2026-09-20T17:00:00.000Z",
    executedAt: "2026-09-20T17:00:01.000Z",
    completedAt: "2026-09-20T17:00:02.000Z",
    status: "verified",
    providerReceipt: "gmail-message:42",
    idempotencyKey: "request-42",
    provenance: [
      {
        sourceType: "connector",
        sourceId: "thread-7",
        provider: "gmail",
        connectionId: "gmail-1",
        observedAt: "2026-09-20T16:59:59.000Z",
        purpose: "reply context"
      }
    ],
    ...overrides
  };
}

describe("action receipt validation", () => {
  it("accepts a complete verified receipt", () => {
    expect(validateActionReceipt(receipt())).toEqual({ valid: true, errors: [] });
  });

  it("requires provider evidence before status can be verified", () => {
    const result = validateActionReceipt(receipt({ providerReceipt: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("verified receipt requires providerReceipt");
  });

  it("rejects impossible receipt chronology", () => {
    const result = validateActionReceipt(
      receipt({ executedAt: "2026-09-20T16:59:00.000Z" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("executedAt cannot precede requestedAt");
  });

  it("requires blocked status for a hard policy block", () => {
    const result = validateActionReceipt(receipt({ policyClass: "BLOCK", status: "verified" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("BLOCK policyClass must produce blocked receipt status");
  });

  it("rejects credential-like material in provenance", () => {
    const result = validateActionReceipt(
      receipt({
        provenance: [
          {
            sourceType: "connector",
            sourceId: "token=should-not-be-here",
            provider: "gmail"
          }
        ]
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("credential-like"))).toBe(true);
  });

  it("rejects duplicate provenance references", () => {
    const ref = {
      sourceType: "file" as const,
      sourceId: "file-1",
      provider: "drive",
      connectionId: "drive-1"
    };
    const result = validateActionReceipt(receipt({ provenance: [ref, ref] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("duplicates"))).toBe(true);
  });
});
