import {
  verifyEnvironmentBlueprintRevision,
  type EnvironmentBlueprint,
  type EnvironmentBlueprintRevisionRecord,
} from "@openrabbit/runtime-core";
import type { EnvironmentBlueprintApiBackend } from "./environment-api.js";
import type { PlatformApiBackend } from "./platform-api.js";

const PROJECT_REF_PATTERN = /^[a-z]{20}$/;

export interface SupabaseEnvironmentBackendOptions {
  supabaseUrl: string;
  projectRef: string;
  serviceRoleKey: string;
  baseBackend: PlatformApiBackend;
  fetchImpl?: typeof fetch;
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

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function normalizeProjectBoundary(supabaseUrl: string, projectRef: string): URL {
  const ref = requireText(projectRef, "projectRef").toLowerCase();
  if (!PROJECT_REF_PATTERN.test(ref)) {
    throw new Error("projectRef must be a 20-character lowercase Supabase project ref");
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

function decodeRevisionRow(row: RevisionRow, expectedOrgId: string): EnvironmentBlueprint {
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
  return blueprint;
}

export function createSupabaseEnvironmentBackend(
  options: SupabaseEnvironmentBackendOptions,
): EnvironmentBlueprintApiBackend {
  const projectOrigin = normalizeProjectBoundary(options.supabaseUrl, options.projectRef);
  const serviceRoleKey = requireText(options.serviceRoleKey, "serviceRoleKey");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");

  return {
    ...options.baseBackend,
    async getEnvironmentBlueprint(orgId: string): Promise<EnvironmentBlueprint | undefined> {
      const organization = requireText(orgId, "orgId");
      const endpoint = new URL("/rest/v1/environment_blueprint_revisions", projectOrigin);
      endpoint.searchParams.set(
        "select",
        "protocol,org_id,revision,generated_at,blueprint,previous_record_hash,record_hash",
      );
      endpoint.searchParams.set("org_id", `eq.${organization}`);
      endpoint.searchParams.set("order", "append_seq.desc");
      endpoint.searchParams.set("limit", "1");

      const response = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
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
    },
  };
}
