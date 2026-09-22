import { describe, expect, it } from "vitest";
import {
  canonicalActionReceipt,
  sealActionReceipt,
  verifyActionReceiptSeal
} from "../../src/core/action-receipt-integrity.js";
import type { ActionReceipt } from "../../src/interfaces/action-receipt.js";

function receipt(): ActionReceipt {
  return {
    id: "receipt-1",
    orgId: "org-1",
    action: "calendar.create_event",
    createdAt: "2026-09-22T16:00:00.000Z",
    userId: "user-1",
    taskId: "task-1",
    provenance: {
      actorType: "worker",
      commandOrigin: "agent_delegation",
      workerId: "worker-1",
      delegationChain: ["user-1", "worker-1"]
    },
    policy: {
      guardianDecision: "require_confirmation",
      policyVersion: "guardian-v1",
      risk: "moderate",
      requiredCapabilities: ["calendar.write"],
      approvalId: "approval-1"
    },
    provider: {
      provider: "google_calendar",
      executionMode: "native_api",
      providerAuthorized: true,
      externalReceiptId: "google-event-1"
    },
    contextCategories: ["calendar"],
    externallyVisible: true,
    reversible: true,
    effectStatus: "confirmed",
    metadata: { source: { channel: "app", attempt: 1 } }
  };
}

describe("Action Receipt integrity", () => {
  it("produces deterministic canonical evidence independent of object key order", () => {
    const original = receipt();
    const reordered = JSON.parse(JSON.stringify(original)) as ActionReceipt;
    reordered.metadata = { source: { attempt: 1, channel: "app" } };

    expect(canonicalActionReceipt(reordered)).toBe(canonicalActionReceipt(original));
    expect(sealActionReceipt(reordered).receiptHash).toBe(
      sealActionReceipt(original).receiptHash
    );
  });

  it("detects receipt tampering", () => {
    const original = receipt();
    const seal = sealActionReceipt(original);
    const tampered = JSON.parse(JSON.stringify(original)) as ActionReceipt;
    tampered.policy.requiredCapabilities.push("mail.send");

    expect(verifyActionReceiptSeal(original, seal)).toBe(true);
    expect(verifyActionReceiptSeal(tampered, seal)).toBe(false);
  });

  it("binds each seal to the preceding receipt hash when chained", () => {
    const first = receipt();
    const firstSeal = sealActionReceipt(first);

    const second = receipt();
    second.id = "receipt-2";
    second.provider = {
      ...second.provider!,
      externalReceiptId: "google-event-2"
    };
    const secondSeal = sealActionReceipt(second, firstSeal.receiptHash);

    expect(secondSeal.previousReceiptHash).toBe(firstSeal.receiptHash);
    expect(verifyActionReceiptSeal(second, secondSeal)).toBe(true);

    const wrongPrevious = "0".repeat(64);
    expect(
      verifyActionReceiptSeal(second, {
        ...secondSeal,
        previousReceiptHash: wrongPrevious
      })
    ).toBe(false);
  });

  it("rejects malformed previous receipt digests", () => {
    expect(() => sealActionReceipt(receipt(), "not-a-digest")).toThrow(
      "previousReceiptHash must be a 64-character SHA-256 digest"
    );
  });
});
