import { URL } from "node:url";
import {
  sealActionReceipt,
  verifyActionReceiptSeal,
  type ActionReceipt
} from "@openrabbit/runtime-core";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const RECEIPT_SELECT =
  "protocol,org_id,receipt_id,created_at,receipt,previous_receipt_hash,receipt_hash";

export interface PersistedActionReceiptRecord {
  protocol: "action_receipt_record_v1";
  orgId: string;
  receiptId: string;
  createdAt: string;
  receipt: ActionReceipt;
  previousReceiptHash?: string;
  receiptHash: string;
}

export interface SupabaseActionReceiptLedgerOptions {
  supabaseUrl: string;
  projectRef: string;
  serviceRoleKey: string;
  fetchImpl?: typeof globalThis.fetch;
}

export interface SupabaseActionReceiptLedger {
  append(receipt: ActionReceipt): Promise<PersistedActionReceiptRecord>;
  get(orgId: string, receiptId: string): Promise<PersistedActionReceiptRecord | undefined>;
  list(orgId: string, limit?: number): Promise<PersistedActionReceiptRecord[]>;
  verifyOrgChain(orgId: string): Promise<boolean>;
}

interface ReceiptRow {
  protocol: unknown;
  org_id: unknown;
  receipt_id: unknown;
  created_at: unknown;
  receipt: unknown;
  previous_receipt_hash: unknown;
  receipt_hash: unknown;
}

interface StorageClient {
  projectOrigin: URL;
  serviceRoleKey: string;
  fetchImpl: typeof globalThis.fetch;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function normalizeProjectBoundary(supabaseUrl: string, projectRef: string): URL {
  const project = requireText(projectRef, "projectRef").toLowerCase();
  if (!PROJECT_REF_PATTERN.test(project)) {
    throw new Error("projectRef must be a canonical 20-character Supabase project ref");
  }
  const parsed = new URL(requireText(supabaseUrl, "supabaseUrl"));
  if (parsed.protocol !== "https:") throw new Error("supabaseUrl must use https");
  const expectedHost = `${project}.supabase.co`;
  if (parsed.hostname.toLowerCase() !== expectedHost || parsed.pathname !== "/") {
    throw new Error("supabaseUrl does not match the configured projectRef");
  }
  return new URL(`https://${expectedHost}`);
}

function createStorageClient(options: SupabaseActionReceiptLedgerOptions): StorageClient {
  const projectOrigin = normalizeProjectBoundary(options.supabaseUrl, options.projectRef);
  const serviceRoleKey = requireText(options.serviceRoleKey, "serviceRoleKey");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  return { projectOrigin, serviceRoleKey, fetchImpl };
}

function headers(serviceRoleKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

function asReceipt(value: unknown): ActionReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("persisted action receipt is invalid");
  }
  return value as ActionReceipt;
}

function asDigest(value: unknown, field: string, optional = false): string | undefined {
  if ((value === null || value === undefined) && optional) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a SHA-256 digest`);
  }
  return value;
}

function decodeReceiptRow(row: ReceiptRow, expectedOrgId?: string): PersistedActionReceiptRecord {
  if (row.protocol !== "action_receipt_record_v1") {
    throw new Error("action receipt record protocol is unsupported");
  }
  if (typeof row.org_id !== "string" || !row.org_id.trim()) {
    throw new Error("persisted action receipt org_id is invalid");
  }
  if (expectedOrgId && row.org_id !== expectedOrgId) {
    throw new Error("persisted action receipt crossed organization boundary");
  }
  if (typeof row.receipt_id !== "string" || !row.receipt_id.trim()) {
    throw new Error("persisted action receipt receipt_id is invalid");
  }
  if (typeof row.created_at !== "string" || Number.isNaN(Date.parse(row.created_at))) {
    throw new Error("persisted action receipt created_at is invalid");
  }

  const receipt = asReceipt(row.receipt);
  if (receipt.orgId !== row.org_id || receipt.id !== row.receipt_id) {
    throw new Error("persisted action receipt identity does not match row identity");
  }
  if (Date.parse(receipt.createdAt) !== Date.parse(row.created_at)) {
    throw new Error("persisted action receipt timestamp does not match row timestamp");
  }

  const previousReceiptHash = asDigest(
    row.previous_receipt_hash,
    "previous_receipt_hash",
    true
  );
  const receiptHash = asDigest(row.receipt_hash, "receipt_hash")!;
  if (
    !verifyActionReceiptSeal(receipt, {
      algorithm: "sha256",
      receiptHash,
      ...(previousReceiptHash ? { previousReceiptHash } : {})
    })
  ) {
    throw new Error("persisted action receipt failed cryptographic integrity verification");
  }

  return {
    protocol: "action_receipt_record_v1",
    orgId: row.org_id,
    receiptId: row.receipt_id,
    createdAt: row.created_at,
    receipt,
    ...(previousReceiptHash ? { previousReceiptHash } : {}),
    receiptHash
  };
}

async function readRows(
  client: StorageClient,
  endpoint: URL,
  expectedOrgId: string
): Promise<PersistedActionReceiptRecord[]> {
  const response = await client.fetchImpl(endpoint, {
    method: "GET",
    headers: headers(client.serviceRoleKey)
  });
  if (!response.ok) {
    throw new Error(`Supabase action receipt read failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Supabase action receipt read returned a non-array payload");
  }
  return payload.map((row) => decodeReceiptRow(row as ReceiptRow, expectedOrgId));
}

function collectionUrl(client: StorageClient): URL {
  return new URL("/rest/v1/action_receipt_records", client.projectOrigin);
}

export function createSupabaseActionReceiptLedger(
  options: SupabaseActionReceiptLedgerOptions
): SupabaseActionReceiptLedger {
  const client = createStorageClient(options);

  async function latest(orgId: string): Promise<PersistedActionReceiptRecord | undefined> {
    const organization = requireText(orgId, "orgId");
    const endpoint = collectionUrl(client);
    endpoint.searchParams.set("select", RECEIPT_SELECT);
    endpoint.searchParams.set("org_id", `eq.${organization}`);
    endpoint.searchParams.set("order", "append_seq.desc");
    endpoint.searchParams.set("limit", "1");
    const rows = await readRows(client, endpoint, organization);
    if (rows.length > 1) throw new Error("Supabase action receipt latest read was ambiguous");
    return rows[0];
  }

  return {
    async append(receipt: ActionReceipt): Promise<PersistedActionReceiptRecord> {
      const orgId = requireText(receipt.orgId, "action receipt orgId");
      requireText(receipt.id, "action receipt id");
      if (Number.isNaN(Date.parse(receipt.createdAt))) {
        throw new Error("action receipt createdAt is invalid");
      }

      const predecessor = await latest(orgId);
      const seal = sealActionReceipt(receipt, predecessor?.receiptHash);
      const endpoint = collectionUrl(client);
      const row = {
        protocol: "action_receipt_record_v1",
        org_id: orgId,
        receipt_id: receipt.id,
        created_at: receipt.createdAt,
        receipt,
        previous_receipt_hash: seal.previousReceiptHash ?? null,
        receipt_hash: seal.receiptHash
      };
      const response = await client.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          ...headers(client.serviceRoleKey),
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(row)
      });
      if (!response.ok) {
        throw new Error(`Supabase action receipt append failed with status ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || payload.length !== 1) {
        throw new Error("Supabase action receipt append returned an ambiguous representation");
      }
      const persisted = decodeReceiptRow(payload[0] as ReceiptRow, orgId);
      if (persisted.receiptHash !== seal.receiptHash) {
        throw new Error("Supabase action receipt append returned a different receipt record");
      }
      return persisted;
    },

    async get(orgId: string, receiptId: string): Promise<PersistedActionReceiptRecord | undefined> {
      const organization = requireText(orgId, "orgId");
      const id = requireText(receiptId, "receiptId");
      const endpoint = collectionUrl(client);
      endpoint.searchParams.set("select", RECEIPT_SELECT);
      endpoint.searchParams.set("org_id", `eq.${organization}`);
      endpoint.searchParams.set("receipt_id", `eq.${id}`);
      endpoint.searchParams.set("limit", "1");
      const rows = await readRows(client, endpoint, organization);
      if (rows.length > 1) throw new Error("Supabase action receipt get was ambiguous");
      return rows[0];
    },

    async list(orgId: string, limit = 100): Promise<PersistedActionReceiptRecord[]> {
      const organization = requireText(orgId, "orgId");
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("action receipt list limit must be an integer between 1 and 1000");
      }
      const endpoint = collectionUrl(client);
      endpoint.searchParams.set("select", RECEIPT_SELECT);
      endpoint.searchParams.set("org_id", `eq.${organization}`);
      endpoint.searchParams.set("order", "append_seq.asc");
      endpoint.searchParams.set("limit", String(limit));
      return readRows(client, endpoint, organization);
    },

    async verifyOrgChain(orgId: string): Promise<boolean> {
      const records = await this.list(orgId, 1000);
      for (let index = 0; index < records.length; index += 1) {
        const expectedPrevious = index === 0 ? undefined : records[index - 1]?.receiptHash;
        if (records[index]?.previousReceiptHash !== expectedPrevious) return false;
      }
      return true;
    }
  };
}
