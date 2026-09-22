import { describe, expect, it } from "vitest";
import { InMemoryActionReceiptStore } from "../../src/core/in-memory-action-receipt-store.js";

function receiptInput(id = "receipt-1", orgId = "org-1") {
  return {
    id,
    orgId,
    action: "calendar.create_event",
    userId: "user-1",
    taskId: "task-1",
    provenance: {
      actorType: "worker" as const,
      commandOrigin: "agent_delegation" as const,
      workerId: "worker-1",
      delegationChain: ["user-1", "worker-1"]
    },
    policy: {
      guardianDecision: "require_confirmation" as const,
      policyVersion: "guardian-v1",
      risk: "moderate" as const,
      requiredCapabilities: ["calendar.write"],
      approvalId: "approval-1"
    },
    provider: {
      provider: "google_calendar",
      executionMode: "native_api" as const,
      providerAuthorized: true,
      externalReceiptId: "google-event-1"
    },
    contextCategories: ["calendar"],
    externallyVisible: true,
    reversible: true,
    effectStatus: "confirmed" as const,
    metadata: { source: { channel: "app" } }
  };
}

describe("InMemoryActionReceiptStore", () => {
  it("stores append-only provenance and filters by tenant", () => {
    const store = new InMemoryActionReceiptStore();
    store.append(receiptInput("receipt-1", "org-1"));
    store.append(receiptInput("receipt-2", "org-2"));

    expect(store.list("org-1")).toHaveLength(1);
    expect(store.get("org-1", "receipt-2")).toBeUndefined();
    expect(store.list("org-1", { workerId: "worker-1" })[0]?.id).toBe(
      "receipt-1"
    );
  });

  it("returns defensive copies so callers cannot rewrite stored evidence", () => {
    const store = new InMemoryActionReceiptStore();
    const saved = store.append(receiptInput());

    saved.provenance.delegationChain?.push("attacker");
    saved.policy.requiredCapabilities.push("mail.send");
    if (saved.metadata) saved.metadata.source = "mutated";

    const reread = store.get("org-1", "receipt-1");
    expect(reread?.provenance.delegationChain).toEqual(["user-1", "worker-1"]);
    expect(reread?.policy.requiredCapabilities).toEqual(["calendar.write"]);
    expect(reread?.metadata).toEqual({ source: { channel: "app" } });
  });

  it("rejects duplicate ids, duplicate capabilities, and unverified confirmed provider effects", () => {
    const store = new InMemoryActionReceiptStore();
    store.append(receiptInput());
    expect(() => store.append(receiptInput())).toThrow("already exists");

    const duplicateCapability = receiptInput("receipt-2");
    duplicateCapability.policy.requiredCapabilities = [
      "calendar.write",
      "calendar.write"
    ];
    expect(() => store.append(duplicateCapability)).toThrow("must be unique");

    const noProviderProof = receiptInput("receipt-3");
    noProviderProof.provider.externalReceiptId = undefined;
    expect(() => store.append(noProviderProof)).toThrow(
      "confirmed provider effects require provider requestId or externalReceiptId"
    );
  });
});
