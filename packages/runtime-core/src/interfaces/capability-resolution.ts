export type CapabilityRiskLevel =
  | "read"
  | "write_internal"
  | "write_external"
  | string;

export type CapabilityExecutionPolicy =
  | "read_only"
  | "draft_only"
  | "approval_required"
  | "automatic"
  | string;

export interface RegisteredCapability {
  capability_id: string;
  contract_version: string;
  risk_level: CapabilityRiskLevel;
  default_execution_policy: CapabilityExecutionPolicy;
  providers: string[];
  supports_dry_run: boolean;
  supports_idempotency: boolean;
  emits_telemetry: boolean;
}

export interface RegisteredCapabilityProvider {
  provider_id: string;
  adapter_version: string;
  capabilities: string[];
  credential_scope: "tenant" | "platform" | string;
  state: "available" | "degraded" | "disabled" | string;
  healthcheck: boolean;
  priority: number;
}

export interface CapabilityRegistryDocument {
  registry_version: string;
  capabilities: RegisteredCapability[];
  providers: RegisteredCapabilityProvider[];
}

export interface CapabilityExecutionContext {
  orgId: string;
  actorId: string;
  requestId: string;
  approvalGranted?: boolean;
  allowedCapabilityIds?: string[];
  dryRun?: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityProviderExecution {
  capabilityId: string;
  contractVersion: string;
  orgId: string;
  actorId: string;
  requestId: string;
  input: unknown;
  dryRun: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityProviderAdapter {
  readonly providerId: string;
  execute(request: CapabilityProviderExecution): Promise<unknown>;
  isHealthy?(): Promise<boolean> | boolean;
}

export type CapabilityResolutionStatus =
  | "completed"
  | "approval_required"
  | "blocked"
  | "failed";

export interface CapabilityResolutionResult {
  status: CapabilityResolutionStatus;
  capabilityId: string;
  providerId?: string;
  output?: unknown;
  reason?: string;
  attemptedProviders: string[];
}

export interface CapabilityExecutionTelemetryEvent {
  timestamp: string;
  requestId: string;
  orgId: string;
  actorId: string;
  capabilityId: string;
  providerId?: string;
  status: CapabilityResolutionStatus;
  attempt: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityTelemetrySink {
  record(event: CapabilityExecutionTelemetryEvent): Promise<void> | void;
}

export interface CapabilityResolver {
  execute(
    capabilityId: string,
    input: unknown,
    context: CapabilityExecutionContext
  ): Promise<CapabilityResolutionResult>;
}
