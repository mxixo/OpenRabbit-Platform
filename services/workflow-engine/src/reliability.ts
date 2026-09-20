import {
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionResult
} from "./contracts.js";

export interface WorkflowIdempotencyStore {
  get(scopeKey: string): WorkflowExecutionResult | undefined;
  set(scopeKey: string, result: WorkflowExecutionResult): void;
}

export class InMemoryWorkflowIdempotencyStore implements WorkflowIdempotencyStore {
  private readonly completed = new Map<string, WorkflowExecutionResult>();

  get(scopeKey: string): WorkflowExecutionResult | undefined {
    const result = this.completed.get(scopeKey);
    return result ? structuredClone(result) : undefined;
  }

  set(scopeKey: string, result: WorkflowExecutionResult): void {
    if (result.status !== "completed") {
      throw new Error("only completed workflow results may be stored for idempotent replay");
    }
    this.completed.set(scopeKey, structuredClone(result));
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
