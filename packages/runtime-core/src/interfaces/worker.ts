/**
 * Worker layer contracts.
 *
 * Workers are configurable AI employees. They are product objects, not runtimes.
 * AgentRegistry remains a lower-level substrate; WorkerDefinition is the org-facing model.
 */

import type {
  RuntimeProvider,
  RuntimeSession,
  RuntimeTaskResult,
  ToolRef
} from "./runtime-provider.js";

export type WorkerMemoryScope = "org" | "team" | "worker" | "thread";

export type WorkerStatus = "active" | "inactive" | "suspended";

export type BuiltinWorkerRole =
  | "executive_assistant"
  | "marketing_manager"
  | "acquisitions_analyst"
  | "finance_analyst"
  | "operations_manager"
  | "research_analyst"
  | "customer_support"
  | "custom";

export interface ApprovalPolicyRef {
  /** Policy id understood by the platform policy service. */
  policyId: string;
  /** When true, tasks may require human approval before side effects. */
  requiresApproval?: boolean;
  /** Optional max auto-retries before escalation. */
  maxAutoRetries?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Org-scoped configurable AI worker (AI employee).
 */
export interface WorkerDefinition {
  id: string;
  orgId: string;
  role: BuiltinWorkerRole | string;
  displayName: string;
  mission: string;
  /** Ordered runtime provider ids (first available wins). */
  runtimePreference: string[];
  allowedCapabilities: string[];
  allowedTools: string[];
  memoryScope: WorkerMemoryScope;
  approvalPolicy: ApprovalPolicyRef;
  status?: WorkerStatus;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Reusable worker template used by industry packs and onboarding.
 * Not org-bound until materialized into a WorkerDefinition.
 */
export interface WorkerPreset {
  id: string;
  role: BuiltinWorkerRole | string;
  displayName: string;
  mission: string;
  runtimePreference: string[];
  allowedCapabilities: string[];
  allowedTools: string[];
  memoryScope: WorkerMemoryScope;
  approvalPolicy: ApprovalPolicyRef;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkerRegistry {
  register(worker: WorkerDefinition): void;
  get(workerId: string): WorkerDefinition | undefined;
  list(filter?: { orgId?: string; role?: string; status?: WorkerStatus }): WorkerDefinition[];
  update(workerId: string, patch: Partial<Omit<WorkerDefinition, "id">>): WorkerDefinition;
  unregister(workerId: string): void;
}

export interface WorkerTaskRequest {
  workerId: string;
  taskId: string;
  taskType: string;
  input: unknown;
  /** Optional explicit session reuse. */
  sessionId?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export type WorkerTaskStatus =
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled"
  | "rejected";

export interface WorkerTaskResult {
  workerId: string;
  taskId: string;
  status: WorkerTaskStatus;
  runtimeProviderId?: string;
  sessionId?: string;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  runtimeResult?: RuntimeTaskResult;
  completedAt: string;
}

export interface WorkerOrchestratorDeps {
  workers: WorkerRegistry;
  runtimes: {
    resolvePreference(preferredProviderIds: readonly string[]): RuntimeProvider;
  };
  /**
   * Optional tool catalog used to project WorkerDefinition.allowedTools into sessions.
   * If omitted, allowed tool names are projected as bare ToolRefs.
   */
  resolveTools?: (toolNames: readonly string[]) => ToolRef[];
}

/**
 * Routes worker tasks to a RuntimeProvider with allow-list enforcement.
 */
export interface WorkerOrchestrator {
  /**
   * Ensure a runtime session exists for the worker (creates one if needed).
   */
  ensureSession(workerId: string): Promise<RuntimeSession>;

  /**
   * Run a task for a worker: resolve worker → pick runtime → project tools → runTask.
   */
  runTask(request: WorkerTaskRequest): Promise<WorkerTaskResult>;

  /**
   * Stop an active session for a worker (no-op if none).
   */
  stopSession(workerId: string): Promise<void>;
}

/**
 * Materialize a preset into an org-scoped worker definition.
 */
export function materializeWorkerPreset(
  preset: WorkerPreset,
  input: { id: string; orgId: string; displayName?: string; status?: WorkerStatus }
): WorkerDefinition {
  return {
    id: input.id,
    orgId: input.orgId,
    role: preset.role,
    displayName: input.displayName ?? preset.displayName,
    mission: preset.mission,
    runtimePreference: [...preset.runtimePreference],
    allowedCapabilities: [...preset.allowedCapabilities],
    allowedTools: [...preset.allowedTools],
    memoryScope: preset.memoryScope,
    approvalPolicy: { ...preset.approvalPolicy },
    status: input.status ?? "active",
    tags: preset.tags ? [...preset.tags] : undefined,
    metadata: preset.metadata ? { ...preset.metadata } : undefined
  };
}
