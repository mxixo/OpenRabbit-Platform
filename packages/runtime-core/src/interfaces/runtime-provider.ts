/**
 * Runtime layer contracts.
 *
 * A RuntimeProvider is an AI execution engine adapter (e.g. OpenClaw).
 * OpenRabbit Core depends on these interfaces only — never on a concrete runtime SDK.
 */

export type RuntimeProviderCapability =
  | "tools"
  | "streaming"
  | "memory-projection"
  | "multi-session"
  | string;

export interface ToolRef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  tags?: string[];
}

export interface RuntimeSessionStart {
  /** Stable correlation id for the session request (caller-generated). */
  requestId: string;
  orgId: string;
  workerId: string;
  /** Preferred runtime is implied by the provider instance; optional hints for adapter. */
  metadata?: Record<string, unknown>;
  /** Tools the platform projects into this session (allow-listed). */
  projectedTools?: ToolRef[];
  /** Capability module ids enabled for this worker/session. */
  allowedCapabilities?: string[];
  memoryScope?: "org" | "team" | "worker" | "thread";
}

export type RuntimeSessionStatus = "starting" | "ready" | "busy" | "stopped" | "failed";

export interface RuntimeSession {
  sessionId: string;
  runtimeProviderId: string;
  orgId: string;
  workerId: string;
  status: RuntimeSessionStatus;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeTaskRequest {
  sessionId: string;
  taskId: string;
  taskType: string;
  input: unknown;
  /** Optional timeout hint in milliseconds. */
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export type RuntimeTaskStatus = "completed" | "failed" | "blocked" | "cancelled";

export interface RuntimeTaskError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface RuntimeTaskResult {
  taskId: string;
  sessionId: string;
  status: RuntimeTaskStatus;
  output?: unknown;
  error?: RuntimeTaskError;
  /** Structured events emitted during the task (adapter-normalized). */
  events?: RuntimeTaskEvent[];
  completedAt: string;
}

export interface RuntimeTaskEvent {
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

/**
 * Pluggable AI runtime adapter.
 * Implementations live under runtimes/<name>/ (e.g. runtimes/openclaw).
 */
export interface RuntimeProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: readonly RuntimeProviderCapability[];

  startSession(input: RuntimeSessionStart): Promise<RuntimeSession>;
  stopSession(sessionId: string): Promise<void>;
  runTask(input: RuntimeTaskRequest): Promise<RuntimeTaskResult>;
  listProjectedTools?(sessionId: string): Promise<ToolRef[]>;
  getSession?(sessionId: string): Promise<RuntimeSession | undefined>;
}

/**
 * Registry of available runtime providers in a deployment.
 */
export interface RuntimeProviderRegistry {
  register(provider: RuntimeProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): RuntimeProvider | undefined;
  list(): RuntimeProvider[];
  /**
   * Resolve the first available provider from an ordered preference list.
   * Throws if none of the preferred providers are registered.
   */
  resolvePreference(preferredProviderIds: readonly string[]): RuntimeProvider;
}
