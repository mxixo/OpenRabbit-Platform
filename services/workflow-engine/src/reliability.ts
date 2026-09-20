import {
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionResult
} from "./contracts.js";

export type WorkflowIdempotencyClaim =
  | { state: "acquired" }
  | { state: "in_progress" }
  | { state: "completed"; result: WorkflowExecutionResult };

export interface WorkflowIdempotencyStore {
  /**
   * Atomically inspect-or-claim one idempotency scope.
   *
   * Production implementations must make this a single compare-and-set style
   * operation in durable storage. A read followed by a separate write is not
   * sufficient because two workers could both pass the read before either
   * records ownership.
   */
  claim(scopeKey: string): WorkflowIdempotencyClaim;

  /** Persist the terminal successful result for replay. */
  complete(scopeKey: string, result: WorkflowExecutionResult): void;
}

type InMemoryEntry =
  | { state: "in_progress" }
  | { state: "completed"; result: WorkflowExecutionResult };

function cloneResult(result: WorkflowExecutionResult): WorkflowExecutionResult {
  return JSON.parse(JSON.stringify(result)) as WorkflowExecutionResult;
}

/**
 * Single-process reference store.
 *
 * `claim()` is synchronous, so JavaScript cannot interleave another claim in
 * the middle of its check-and-set operation. This closes the same-process
 * duplicate-write race while keeping the required atomic contract explicit for
 * a future database/Redis implementation.
 *
 * An unsuccessful/blocked workflow intentionally leaves its claim in-progress.
 * Releasing it automatically could replay already-completed external side
 * effects. Durable production storage must add leases/recovery and explicit
 * reconciliation before such a claim can be retried safely.
 */
export class InMemoryWorkflowIdempotencyStore implements WorkflowIdempotencyStore {
  private readonly entries = new Map<string, InMemoryEntry>();

  claim(scopeKey: string): WorkflowIdempotencyClaim {
    const existing = this.entries.get(scopeKey);
    if (existing?.state === "completed") {
      return { state: "completed", result: cloneResult(existing.result) };
    }
    if (existing?.state === "in_progress") {
      return { state: "in_progress" };
    }

    this.entries.set(scopeKey, { state: "in_progress" });
    return { state: "acquired" };
  }

  complete(scopeKey: string, result: WorkflowExecutionResult): void {
    if (result.status !== "completed") {
      throw new Error("only completed workflow results may be stored for idempotent replay");
    }

    const existing = this.entries.get(scopeKey);
    if (!existing) {
      throw new Error("idempotency scope must be claimed before completion");
    }
    if (existing.state === "completed") {
      throw new Error("idempotency scope is already completed");
    }

    this.entries.set(scopeKey, { state: "completed", result: cloneResult(result) });
  }
}

function normalizeRequired(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} cannot be blank`);
  }
  return normalized;
}

export function workflowIdempotencyScopeKey(
  definition: WorkflowDefinition,
  context: WorkflowExecutionContext
): string | undefined {
  const hasTenant = context.tenantId !== undefined;
  const hasKey = context.idempotencyKey !== undefined;

  if (!hasTenant && !hasKey) {
    return undefined;
  }
  if (hasTenant !== hasKey) {
    throw new Error("tenantId and idempotencyKey must be supplied together");
  }

  const tenantId = normalizeRequired(context.tenantId, "tenantId");
  const idempotencyKey = normalizeRequired(context.idempotencyKey, "idempotencyKey");
  const workflowId = normalizeRequired(definition.workflowId, "workflowId");
  const version = normalizeRequired(definition.version, "workflow version");

  return JSON.stringify([tenantId, workflowId, version, idempotencyKey]);
}
