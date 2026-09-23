import { URL } from "node:url";
import {
  sealEnvironmentBlueprintRevision,
  verifyEnvironmentBlueprintRevision,
  type EnvironmentBlueprint,
  type EnvironmentBlueprintRevisionRecord,
} from "@openrabbit/runtime-core";
import type { EnvironmentBlueprintApiBackend } from "./environment-api.js";
import type { PlatformApiBackend } from "./platform-api.js";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const REVISION_SELECT =
  "protocol,org_id,revision,generated_at,blueprint,previous_record_hash,record_hash";

export interface SupabaseEnvironmentBackendOptions {
  supabaseUrl: string;
  projectRef: string;
  serviceRoleKey: string;
  baseBackend: PlatformApiBackend;
  fetchImpl?: typeof globalThis.fetch;
}

export interface SupabaseEnvironmentRevisionWriterOptions {
  supabaseUrl: string;
  projectRef: string;
  serviceRoleKey: string;
  fetchImpl?: typeof globalThis.fetch;
}

export interface SupabaseEnvironmentRevisionWriter {
  appendEnvironmentBlueprint(
    blueprint: EnvironmentBlueprint,
  ): Promise<EnvironmentBlueprintRevisionRecord>;
}

interface RevisionRow {
  protocol: unknown;
  org_id: unknown;
  revision: unknown;
  generated_at: unknown;
  blueprint: unknown;
  previous_record_hash: unknown;
  record_hash: unknown;
}

interface SupabaseEnvironmentStorageClient {
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
  const ref = requireText(projectRef, "projectRef").toLowerCase();
  if (!PROJECT_REF_PATTERN.test(ref)) {
    throw new Error("projectRef must be a 20-character lowercase alphanumeric Supabase project ref");
  }

  let url: URL;
  try {
    url = new URL(requireText(supabaseUrl, "supabaseUrl"));
  } catch {
    throw new Error("supabaseUrl must be a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("supabaseUrl must use HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("supabaseUrl must be a canonical project origin");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("supabaseUrl must not contain a path");
  }
  const expectedHost = `${ref}.supabase.co`;
  if (url.hostname !== expectedHost || url.port) {
    throw new Error("supabaseUrl does not match the explicitly designated projectRef");
  }
  return new URL(`https://${expectedHost}`);
}

function createStorageClient(
  options: SupabaseEnvironmentRevisionWriterOptions,
): SupabaseEnvironmentStorageClient {
  const projectOrigin = normalizeProjectBoundary(options.supabaseUrl, options.projectRef);
  const serviceRoleKey = requireText(options.serviceRoleKey, "serviceRoleKey");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  return { projectOrigin, serviceRoleKey, fetchImpl };
}

function revisionHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function decodeRevisionRow(
  row: RevisionRow,
  expectedOrgId: string,
): EnvironmentBlueprintRevisionRecord {
  if (row.protocol !== "environment_blueprint_revision_v1") {
    throw new Error("environment revision protocol is unsupported");
  }
  if (row.org_id !== expectedOrgId) {
    throw new Error("environment revision belongs to a different organization");
  }
  if (typeof row.revision !== "string" || !row.revision.trim()) {
    throw new Error("environment revision is missing its revision identity");
  }
  if (typeof row.generated_at !== "string" || Number.isNaN(Date.parse(row.generated_at))) {
    throw new Error("environment revision generated_at is invalid");
  }
  if (!row.blueprint || typeof row.blueprint !== "object" || Array.isArray(row.blueprint)) {
    throw new Error("environment revision blueprint is invalid");
  }

  const blueprint = row.blueprint as EnvironmentBlueprint;
  if (blueprint.orgId !== expectedOrgId || blueprint.revision !== row.revision) {
    throw new Error("environment revision identity disagrees with its blueprint");
  }
  if (Number.isNaN(Date.parse(blueprint.generatedAt))) {
    throw new Error("environment blueprint generatedAt is invalid");
  }
  if (Date.parse(blueprint.generatedAt) !== Date.parse(row.generated_at)) {
    throw new Error("environment revision generated_at disagrees with its blueprint");
  }
  if (
    row.previous_record_hash !== null &&
    (typeof row.previous_record_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.previous_record_hash))
  ) {
    throw new Error("environment revision previous_record_hash is invalid");
  }
  if (typeof row.record_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.record_hash)) {
    throw new Error("environment revision record_hash is invalid");
  }

  const record: EnvironmentBlueprintRevisionRecord = {
    protocol: "environment_blueprint_revision_v1",
    orgId: expectedOrgId,
    revision: row.revision,
    generatedAt: blueprint.generatedAt,
    blueprint,
    ...(typeof row.previous_record_hash === "string"
      ? { previousRecordHash: row.previous_record_hash }
      : {}),
    recordHash: row.record_hash,
  };
  if (!verifyEnvironmentBlueprintRevision(record)) {
    throw new Error("environment revision failed cryptographic integrity verification");
  }
  return record;
}

async function readLatestRevision(
  client: SupabaseEnvironmentStorageClient,
  orgId: string,
): Promise<EnvironmentBlueprintRevisionRecord | undefined> {
  const organization = requireText(orgId, "orgId");
  const endpoint = new URL("/rest/v1/environment_blueprint_revisions", client.projectOrigin);
  endpoint.searchParams.set("select", REVISION_SELECT);
  endpoint.searchParams.set("org_id", `eq.${organization}`);
  endpoint.searchParams.set("order", "append_seq.desc");
  endpoint.searchParams.set("limit", "1");

  const response = await client.fetchImpl(endpoint, {
    method: "GET",
    headers: revisionHeaders(client.serviceRoleKey),
  });
  if (!response.ok) {
    throw new Error(`Supabase environment read failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Supabase environment read returned a non-array payload");
  }
  if (payload.length === 0) return undefined;
  if (payload.length !== 1) {
    throw new Error("Supabase environment read returned an ambiguous latest revision");
  }
  return decodeRevisionRow(payload[0] as RevisionRow, organization);
}

export function createSupabaseEnvironmentBackend(
  options: SupabaseEnvironmentBackendOptions,
): EnvironmentBlueprintApiBackend {
  const client = createStorageClient(options);

  return {
    ...options.baseBackend,
    async getEnvironmentBlueprint(orgId: string): Promise<EnvironmentBlueprint | undefined> {
      const revision = await readLatestRevision(client, orgId);
      return revision?.blueprint;
    },
  };
}

export function createSupabaseEnvironmentRevisionWriter(
  options: SupabaseEnvironmentRevisionWriterOptions,
): SupabaseEnvironmentRevisionWriter {
  const client = createStorageClient(options);

  return {
    async appendEnvironmentBlueprint(
      blueprint: EnvironmentBlueprint,
    ): Promise<EnvironmentBlueprintRevisionRecord> {
      if (blueprint.protocol !== "environment_blueprint_v1") {
        throw new Error("environment blueprint protocol is unsupported");
      }
      const orgId = requireText(blueprint.orgId, "environment blueprint orgId");
      const latest = await readLatestRevision(client, orgId);
      if (latest?.revision === blueprint.revision) {
        throw new Error(`environment blueprint revision already exists: ${blueprint.revision}`);
      }
      if (latest && Date.parse(blueprint.generatedAt) < Date.parse(latest.generatedAt)) {
        throw new Error("environment blueprint generatedAt cannot move backward");
      }

      const sealed = sealEnvironmentBlueprintRevision(blueprint, latest?.recordHash);
      const endpoint = new URL("/rest/v1/environment_blueprint_revisions", client.projectOrigin);
      const row = {
        protocol: sealed.protocol,
        org_id: sealed.orgId,
        revision: sealed.revision,
        generated_at: sealed.generatedAt,
        blueprint: sealed.blueprint,
        previous_record_hash: sealed.previousRecordHash ?? null,
        record_hash: sealed.recordHash,
      };
      const response = await client.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          ...revisionHeaders(client.serviceRoleKey),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      });
      if (!response.ok) {
        throw new Error(`Supabase environment append failed with status ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || payload.length !== 1) {
        throw new Error("Supabase environment append returned an ambiguous representation");
      }
      const persisted = decodeRevisionRow(payload[0] as RevisionRow, orgId);
      if (persisted.recordHash !== sealed.recordHash) {
        throw new Error("Supabase environment append returned a different revision record");
      }
      return persisted;
    },
  };
}
