import { createHash } from "node:crypto";

import type { EnvironmentBlueprint } from "../interfaces/environment-blueprint.js";
import type {
  EnvironmentBlueprintRevisionRecord,
  EnvironmentBlueprintRevisionStore,
} from "../interfaces/environment-blueprint-revision.js";

const PROTOCOL = "environment_blueprint_revision_v1" as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function normalizedDigest(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const digest = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${field} must be a 64-character SHA-256 digest`);
  }
  return digest;
}

function assertBlueprint(blueprint: EnvironmentBlueprint): void {
  if (blueprint.protocol !== "environment_blueprint_v1") {
    throw new Error("environment blueprint protocol is unsupported");
  }
  requireText(blueprint.orgId, "environment blueprint orgId");
  requireText(blueprint.revision, "environment blueprint revision");
  if (Number.isNaN(Date.parse(blueprint.generatedAt))) {
    throw new Error("environment blueprint generatedAt must be an ISO-compatible timestamp");
  }
}

function recordBody(
  blueprint: EnvironmentBlueprint,
  previousRecordHash?: string,
): Omit<EnvironmentBlueprintRevisionRecord, "recordHash"> {
  assertBlueprint(blueprint);
  const previous = normalizedDigest(previousRecordHash, "previousRecordHash");
  return {
    protocol: PROTOCOL,
    orgId: blueprint.orgId,
    revision: blueprint.revision,
    generatedAt: blueprint.generatedAt,
    blueprint: clone(blueprint),
    ...(previous ? { previousRecordHash: previous } : {}),
  };
}

function digestBody(
  body: Omit<EnvironmentBlueprintRevisionRecord, "recordHash">,
): string {
  const hash = createHash("sha256");
  hash.update("openrabbit.environment-blueprint-revision.v1\n", "utf8");
  hash.update(JSON.stringify(canonicalize(body)), "utf8");
  return hash.digest("hex");
}

export function sealEnvironmentBlueprintRevision(
  blueprint: EnvironmentBlueprint,
  previousRecordHash?: string,
): EnvironmentBlueprintRevisionRecord {
  const body = recordBody(blueprint, previousRecordHash);
  return { ...body, recordHash: digestBody(body) };
}

export function verifyEnvironmentBlueprintRevision(
  record: EnvironmentBlueprintRevisionRecord,
): boolean {
  if (record.protocol !== PROTOCOL) return false;
  try {
    const body = recordBody(record.blueprint, record.previousRecordHash);
    if (record.orgId !== body.orgId) return false;
    if (record.revision !== body.revision) return false;
    if (record.generatedAt !== body.generatedAt) return false;
    if (record.previousRecordHash !== body.previousRecordHash) return false;
    const observed = normalizedDigest(record.recordHash, "recordHash");
    return observed === digestBody(body);
  } catch {
    return false;
  }
}

export class InMemoryEnvironmentBlueprintRevisionStore
  implements EnvironmentBlueprintRevisionStore
{
  private readonly recordsByOrg = new Map<string, EnvironmentBlueprintRevisionRecord[]>();

  append(record: EnvironmentBlueprintRevisionRecord): void {
    if (!verifyEnvironmentBlueprintRevision(record)) {
      throw new Error("environment blueprint revision record failed integrity verification");
    }
    const orgId = requireText(record.orgId, "environment blueprint revision orgId");
    const revisions = this.recordsByOrg.get(orgId) ?? [];
    const latest = revisions.at(-1);

    if (!latest && record.previousRecordHash) {
      throw new Error("first environment blueprint revision cannot reference a predecessor");
    }
    if (latest && record.previousRecordHash !== latest.recordHash) {
      throw new Error("environment blueprint revision predecessor does not match latest record");
    }
    if (revisions.some((candidate) => candidate.revision === record.revision)) {
      throw new Error(`environment blueprint revision already exists: ${record.revision}`);
    }
    if (latest && Date.parse(record.generatedAt) < Date.parse(latest.generatedAt)) {
      throw new Error("environment blueprint revision generatedAt cannot move backward");
    }

    const next = [...revisions, clone(record)];
    this.recordsByOrg.set(orgId, next);
  }

  getLatest(orgId: string): EnvironmentBlueprintRevisionRecord | undefined {
    const latest = this.recordsByOrg.get(orgId)?.at(-1);
    return latest ? clone(latest) : undefined;
  }

  getRevision(
    orgId: string,
    revision: string,
  ): EnvironmentBlueprintRevisionRecord | undefined {
    const found = this.recordsByOrg
      .get(orgId)
      ?.find((candidate) => candidate.revision === revision);
    return found ? clone(found) : undefined;
  }

  listRevisions(orgId: string): EnvironmentBlueprintRevisionRecord[] {
    return (this.recordsByOrg.get(orgId) ?? []).map(clone);
  }
}
