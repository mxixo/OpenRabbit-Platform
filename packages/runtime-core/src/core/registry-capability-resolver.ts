import {
  CapabilityExecutionContext,
  CapabilityProviderAdapter,
  CapabilityRegistryDocument,
  CapabilityResolutionResult,
  CapabilityTelemetrySink,
  RegisteredCapability,
  RegisteredCapabilityProvider
} from "../interfaces/capability-resolution.js";

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export class RegistryCapabilityResolver {
  private readonly adapters = new Map<string, CapabilityProviderAdapter>();

  constructor(
    private readonly registry: CapabilityRegistryDocument,
    adapters: CapabilityProviderAdapter[],
    private readonly telemetry?: CapabilityTelemetrySink
  ) {
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.providerId)) {
        throw new Error(`Duplicate capability provider adapter: ${adapter.providerId}`);
      }
      this.adapters.set(adapter.providerId, adapter);
    }
  }

  async execute(
    capabilityId: string,
    input: unknown,
    context: CapabilityExecutionContext
  ): Promise<CapabilityResolutionResult> {
    const normalizedCapabilityId = required(capabilityId, "capabilityId");
    const orgId = required(context.orgId, "context.orgId");
    const actorId = required(context.actorId, "context.actorId");
    const requestId = required(context.requestId, "context.requestId");
    const capability = this.requireCapability(normalizedCapabilityId);

    if (
      context.allowedCapabilityIds &&
      !context.allowedCapabilityIds.includes(normalizedCapabilityId)
    ) {
      const blocked = this.result("blocked", capability, [], "actor_not_allowed");
      await this.record(blocked, context, 0);
      return blocked;
    }

    if (context.dryRun && !capability.supports_dry_run) {
      const blocked = this.result("blocked", capability, [], "dry_run_not_supported");
      await this.record(blocked, context, 0);
      return blocked;
    }

    if (context.idempotencyKey && !capability.supports_idempotency) {
      const blocked = this.result("blocked", capability, [], "idempotency_not_supported");
      await this.record(blocked, context, 0);
      return blocked;
    }

    if (
      capability.default_execution_policy === "approval_required" &&
      context.approvalGranted !== true
    ) {
      const pending = this.result(
        "approval_required",
        capability,
        [],
        "human_approval_required"
      );
      await this.record(pending, context, 0);
      return pending;
    }

    const candidates = this.providerCandidates(capability);
    const attempted: string[] = [];
    let lastError: unknown;

    for (const provider of candidates) {
      const adapter = this.adapters.get(provider.provider_id);
      if (!adapter) continue;

      attempted.push(provider.provider_id);
      const attempt = attempted.length;

      try {
        if (adapter.isHealthy && !(await adapter.isHealthy())) {
          await this.record(
            this.result("failed", capability, attempted, "provider_unhealthy", provider.provider_id),
            context,
            attempt
          );
          continue;
        }

        const output = await adapter.execute({
          capabilityId: capability.capability_id,
          contractVersion: capability.contract_version,
          orgId,
          actorId,
          requestId,
          input,
          dryRun: context.dryRun === true,
          idempotencyKey: context.idempotencyKey,
          metadata: context.metadata
        });

        const completed: CapabilityResolutionResult = {
          status: "completed",
          capabilityId: capability.capability_id,
          providerId: provider.provider_id,
          output,
          attemptedProviders: [...attempted]
        };
        await this.record(completed, context, attempt);
        return completed;
      } catch (error) {
        lastError = error;
        await this.record(
          this.result(
            "failed",
            capability,
            attempted,
            error instanceof Error ? error.message : "provider_execution_failed",
            provider.provider_id
          ),
          context,
          attempt
        );
      }
    }

    const reason =
      lastError instanceof Error
        ? lastError.message
        : attempted.length === 0
          ? "no_available_provider"
          : "all_providers_failed";
    return this.result("failed", capability, attempted, reason);
  }

  private requireCapability(capabilityId: string): RegisteredCapability {
    const capability = this.registry.capabilities.find(
      (entry) => entry.capability_id === capabilityId
    );
    if (!capability) throw new Error(`Capability not registered: ${capabilityId}`);
    return capability;
  }

  private providerCandidates(
    capability: RegisteredCapability
  ): RegisteredCapabilityProvider[] {
    const allowed = new Set(capability.providers);
    return this.registry.providers
      .filter(
        (provider) =>
          allowed.has(provider.provider_id) &&
          provider.capabilities.includes(capability.capability_id) &&
          provider.state !== "disabled"
      )
      .sort((a, b) => b.priority - a.priority);
  }

  private result(
    status: CapabilityResolutionResult["status"],
    capability: RegisteredCapability,
    attemptedProviders: string[],
    reason?: string,
    providerId?: string
  ): CapabilityResolutionResult {
    return {
      status,
      capabilityId: capability.capability_id,
      providerId,
      reason,
      attemptedProviders: [...attemptedProviders]
    };
  }

  private async record(
    result: CapabilityResolutionResult,
    context: CapabilityExecutionContext,
    attempt: number
  ): Promise<void> {
    const capability = this.requireCapability(result.capabilityId);
    if (!this.telemetry || capability.emits_telemetry !== true) return;
    await this.telemetry.record({
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      orgId: context.orgId,
      actorId: context.actorId,
      capabilityId: result.capabilityId,
      providerId: result.providerId,
      status: result.status,
      attempt,
      reason: result.reason,
      metadata: context.metadata
    });
  }
}
