import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import { sealActionReceipt, type ActionReceipt } from "@openrabbit/runtime-core";
import { createSupabaseActionReceiptLedger } from "../../src/supabase-action-receipt-ledger.js";

const PROJECT_REF = "abcdefghijklmnopqrst";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function receipt(id = "receipt-1", externalReceiptId = "event-1"): ActionReceipt {
  return {
    id,
    orgId: "org-a",
    action: "calendar.create_event",
    createdAt: "2026-09-23T16:00:00.000Z",
    userId: "user-a",
    taskId: "task-a",
    provenance: {
      actorType: "worker",
      commandOrigin: "agent_delegation",
      workerId: "worker-a"
    },
    policy: {
      guardianDecision: "auto_execute",
      policyVersion: "guardian-v1",
      risk: "low",
      requiredCapabilities: ["calendar.write"]
    },
    provider: {
      provider: "google_calendar",
      executionMode: "native_api",
      providerAuthorized: true,
      externalReceiptId
    },
    contextCategories: ["calendar"],
    externallyVisible: true,
    reversible: true,
    effectStatus: "confirmed"
  };
}

function row(value: ActionReceipt, previousReceiptHash?: string) {
  const seal = sealActionReceipt(value, previousReceiptHash);
  return {
    protocol: "action_receipt_record_v1",
    org_id: value.orgId,
    receipt_id: value.id,
    created_at: value.createdAt,
    receipt: value,
    previous_receipt_hash: seal.previousReceiptHash ?? null,
    receipt_hash: seal.receiptHash
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new globalThis.Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("Supabase Action Receipt ledger", () => {
  it("seals and appends the first receipt only after verifying the org has no predecessor", async () => {
    const requests: Array<{ url: string; method: string; body?: string; authorization?: string }> = [];
    const ledger = createSupabaseActionReceiptLedger({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (input, init) => {
        const method = init?.method ?? "GET";
        const headers = init?.headers as Record<string, string> | undefined;
        const entry: { url: string; method: string; body?: string; authorization?: string } = {
          url: String(input),
          method
        };
        if (typeof init?.body === "string") entry.body = init.body;
        if (headers?.Authorization) entry.authorization = headers.Authorization;
        requests.push(entry);
        if (method === "GET") return jsonResponse([]);
        if (method !== "POST" || typeof init?.body !== "string") {
          throw new Error("unexpected test request");
        }
        return jsonResponse([JSON.parse(init.body)]);
      }
    });

    const persisted = await ledger.append(receipt());

    expect(requests).toHaveLength(2);
    expect(requests[0]?.method).toBe("GET");
    const readUrl = new URL(requests[0]?.url ?? "");
    expect(readUrl.searchParams.get("org_id")).toBe("eq.org-a");
    expect(readUrl.searchParams.get("order")).toBe("append_seq.desc");
    expect(requests[1]?.method).toBe("POST");
    expect(requests[1]?.authorization).toBe("Bearer server-secret");
    expect(requests[1]?.body).not.toContain("server-secret");
    expect(persisted.receiptId).toBe("receipt-1");
    expect(persisted.previousReceiptHash).toBeUndefined();
    expect(persisted.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds a new receipt to the verified latest predecessor", async () => {
    const first = receipt("receipt-1", "event-1");
    const firstRow = row(first);
    const second = receipt("receipt-2", "event-2");
    let postBody: Record<string, unknown> | undefined;
    const ledger = createSupabaseActionReceiptLedger({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (_input, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET") return jsonResponse([firstRow]);
        if (typeof init?.body !== "string") throw new Error("missing post body");
        postBody = JSON.parse(init.body) as Record<string, unknown>;
        return jsonResponse([postBody]);
      }
    });

    const persisted = await ledger.append(second);

    expect(postBody?.previous_receipt_hash).toBe(firstRow.receipt_hash);
    expect(persisted.previousReceiptHash).toBe(firstRow.receipt_hash);
  });

  it("fails closed when Supabase returns a tampered receipt representation", async () => {
    const value = receipt();
    const ledger = createSupabaseActionReceiptLedger({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (_input, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET") return jsonResponse([]);
        if (typeof init?.body !== "string") throw new Error("missing post body");
        const persisted = JSON.parse(init.body) as ReturnType<typeof row>;
        persisted.receipt.action = "mail.send";
        return jsonResponse([persisted]);
      }
    });

    await expect(ledger.append(value)).rejects.toThrow(
      "cryptographic integrity verification"
    );
  });

  it("verifies the persisted per-org predecessor chain and detects a substituted link", async () => {
    const first = receipt("receipt-1", "event-1");
    const firstRow = row(first);
    const second = receipt("receipt-2", "event-2");
    const secondRow = row(second, firstRow.receipt_hash);
    const validLedger = createSupabaseActionReceiptLedger({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async () => jsonResponse([firstRow, secondRow])
    });

    expect(await validLedger.verifyOrgChain("org-a")).toBe(true);

    const substitutedSecond = row(second);
    const invalidLedger = createSupabaseActionReceiptLedger({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async () => jsonResponse([firstRow, substitutedSecond])
    });
    expect(await invalidLedger.verifyOrgChain("org-a")).toBe(false);
  });

  it("rejects a Supabase URL that does not match the explicit project boundary", () => {
    expect(() =>
      createSupabaseActionReceiptLedger({
        supabaseUrl: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co",
        projectRef: PROJECT_REF,
        serviceRoleKey: "server-secret"
      })
    ).toThrow("does not match the configured projectRef");
  });
});
