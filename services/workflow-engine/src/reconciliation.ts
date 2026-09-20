import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ReconciliationOutcome =
  | "confirmed_succeeded"
  | "confirmed_failed"
  | "safe_to_retry";

export type WorkflowReconciliationRecord = {
  schemaVersion: 1;
  scopeKey: string;
  state: "required" | "resolved";
  reason: string;
  evidenceRefs: string[];
  firstObservedAt: string;
  updatedAt: string;
  outcome?: ReconciliationOutcome;
  resolutionNote?: string;
};

export interface WorkflowReconciliationStore {
  get(scopeKey: string): Promise<WorkflowReconciliationRecord | undefined>;
  require(
    scopeKey: string,
    reason: string,
    evidenceRefs?: string[]
  ): Promise<WorkflowReconciliationRecord>;
  resolve(
    scopeKey: string,
    outcome: ReconciliationOutcome,
    resolutionNote: string,
    evidenceRefs?: string[]
  ): Promise<WorkflowReconciliationRecord>;
}

function validateText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} cannot be blank`);
  if (normalized.length > 2048) throw new Error(`${field} is too long`);
  return normalized;
}

function sanitizeEvidenceRefs(values: string[] = []): string[] {
  const unique = new Set<string>();
  for (const raw of values) {
    const value = validateText(raw, "evidence reference");
    if (/bearer\s|api[_-]?key|secret|password|token=/i.test(value)) {
      throw new Error("evidence references must not contain credential-like material");
    }
    unique.add(value);
  }
  return [...unique].sort();
}

function clone(record: WorkflowReconciliationRecord): WorkflowReconciliationRecord {
  return JSON.parse(JSON.stringify(record)) as WorkflowReconciliationRecord;
}

/**
 * Durable operator-facing registry for uncertain external side effects.
 *
 * This is deliberately separate from automatic retry. A workflow whose provider
 * outcome is uncertain should be recorded here, reconciled against provider
 * evidence, and only then classified as confirmed success/failure or safe to
 * retry. The registry stores metadata references only; never provider secrets.
 */
export class FilesystemWorkflowReconciliationStore implements WorkflowReconciliationStore {
  constructor(private readonly rootDirectory: string) {
    if (!rootDirectory.trim()) throw new Error("rootDirectory cannot be blank");
  }

  private recordPath(scopeKey: string): string {
    const digest = createHash("sha256").update(scopeKey, "utf8").digest("hex");
    return join(this.rootDirectory, `${digest}.json`);
  }

  async get(scopeKey: string): Promise<WorkflowReconciliationRecord | undefined> {
    const normalizedScope = validateText(scopeKey, "scopeKey");
    try {
      const parsed = JSON.parse(
        await readFile(this.recordPath(normalizedScope), "utf8")
      ) as WorkflowReconciliationRecord;
      if (parsed.schemaVersion !== 1 || parsed.scopeKey !== normalizedScope) {
        throw new Error("reconciliation record is invalid or belongs to another scope");
      }
      return clone(parsed);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async require(
    scopeKey: string,
    reason: string,
    evidenceRefs: string[] = []
  ): Promise<WorkflowReconciliationRecord> {
    const normalizedScope = validateText(scopeKey, "scopeKey");
    const normalizedReason = validateText(reason, "reason");
    const refs = sanitizeEvidenceRefs(evidenceRefs);
    await mkdir(this.rootDirectory, { recursive: true });

    const existing = await this.get(normalizedScope);
    const now = new Date().toISOString();
    const record: WorkflowReconciliationRecord = existing
      ? {
          ...existing,
          state: "required",
          reason: normalizedReason,
          evidenceRefs: [...new Set([...existing.evidenceRefs, ...refs])].sort(),
          updatedAt: now,
          outcome: undefined,
          resolutionNote: undefined
        }
      : {
          schemaVersion: 1,
          scopeKey: normalizedScope,
          state: "required",
          reason: normalizedReason,
          evidenceRefs: refs,
          firstObservedAt: now,
          updatedAt: now
        };

    await this.atomicWrite(normalizedScope, record);
    return clone(record);
  }

  async resolve(
    scopeKey: string,
    outcome: ReconciliationOutcome,
    resolutionNote: string,
    evidenceRefs: string[] = []
  ): Promise<WorkflowReconciliationRecord> {
    const normalizedScope = validateText(scopeKey, "scopeKey");
    const existing = await this.get(normalizedScope);
    if (!existing) throw new Error("reconciliation must be required before it can be resolved");
    if (!(["confirmed_succeeded", "confirmed_failed", "safe_to_retry"] as string[]).includes(outcome)) {
      throw new Error("unsupported reconciliation outcome");
    }
    const note = validateText(resolutionNote, "resolutionNote");
    const refs = sanitizeEvidenceRefs(evidenceRefs);
    if (refs.length === 0 && existing.evidenceRefs.length === 0) {
      throw new Error("resolution requires at least one provider or audit evidence reference");
    }

    const record: WorkflowReconciliationRecord = {
      ...existing,
      state: "resolved",
      outcome,
      resolutionNote: note,
      evidenceRefs: [...new Set([...existing.evidenceRefs, ...refs])].sort(),
      updatedAt: new Date().toISOString()
    };
    await this.atomicWrite(normalizedScope, record);
    return clone(record);
  }

  private async atomicWrite(
    scopeKey: string,
    record: WorkflowReconciliationRecord
  ): Promise<void> {
    const target = this.recordPath(scopeKey);
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(record), { encoding: "utf8", flag: "wx" });
    await rename(temp, target);
  }
}
