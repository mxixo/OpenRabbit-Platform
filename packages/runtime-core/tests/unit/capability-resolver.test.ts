import { describe, expect, it } from "vitest";
import {
  CapabilityExecutionTelemetryEvent,
  CapabilityProviderAdapter,
  CapabilityRegistryDocument
} from "../../src/interfaces/capability-resolution.js";
import { RegistryCapabilityResolver } from "../../src/core/registry-capability-resolver.js";

const registry: CapabilityRegistryDocument = {
  registry_version: "1.0.0",
  capabilities: [
    {
      capability_id: "work.underwrite",
      contract_version: "1.0.0",
      risk_level: "write_internal",
      default_execution_policy: "approval_required",
      providers: ["primary", "fallback"],
      supports_dry_run: true,
      supports_idempotency: true,
      emits_telemetry: true
    },
    {
      capability_id: "work.deal_read",
      contract_version: "1.0.0",
      risk_level: "read",
      default_execution_policy: "read_only",
      providers: ["primary"],
      supports_dry_run: false,
      supports_idempotency: false,
      emits_telemetry: true
    }
  ],
  providers: [
    {
      provider_id: "primary",
      adapter_version: "1.0.0",
      capabilities: ["work.underwrite", "work.deal_read"],
      credential_scope: "tenant",
      state: "available",
      healthcheck: true,
      priority: 100
    },
    {
      provider_id: "fallback",
      adapter_version: "1.0.0",
      capabilities: ["work.underwrite"],
      credential_scope: "tenant",
      state: "available",
      healthcheck: true,
      priority: 50
    }
  ]
};

describe("RegistryCapabilityResolver", () => {
  it("requires approval before executing approval-gated capability", async () => {
    const adapter: CapabilityProviderAdapter = {
      providerId: "primary",
      execute: async () => ({ ok: true })
    };
    const resolver = new RegistryCapabilityResolver(registry, [adapter]);

    const result = await resolver.execute("work.underwrite", {}, {
      orgId: "org-1",
      actorId: "actor-1",
      requestId: "req-1"
    });

    expect(result.status).toBe("approval_required");
    expect(result.attemptedProviders).toEqual([]);
  });

  it("falls back to the next provider and preserves tenant and actor context", async () => {
    const calls: unknown[] = [];
    const primary: CapabilityProviderAdapter = {
      providerId: "primary",
      execute: async () => {
        throw new Error("primary unavailable");
      }
    };
    const fallback: CapabilityProviderAdapter = {
      providerId: "fallback",
      execute: async (request) => {
        calls.push(request);
        return { recommendation: "review" };
      }
    };

    const resolver = new RegistryCapabilityResolver(registry, [primary, fallback]);
    const result = await resolver.execute("work.underwrite", { dealId: "deal-1" }, {
      orgId: "org-1",
      actorId: "actor-7",
      requestId: "req-2",
      approvalGranted: true,
      allowedCapabilityIds: ["work.underwrite"],
      idempotencyKey: "idem-1"
    });

    expect(result.status).toBe("completed");
    expect(result.providerId).toBe("fallback");
    expect(result.attemptedProviders).toEqual(["primary", "fallback"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      capabilityId: "work.underwrite",
      orgId: "org-1",
      actorId: "actor-7",
      requestId: "req-2",
      idempotencyKey: "idem-1"
    });
  });

  it("blocks an actor whose allowlist does not include the capability", async () => {
    const adapter: CapabilityProviderAdapter = {
      providerId: "primary",
      execute: async () => ({ deal: true })
    };
    const resolver = new RegistryCapabilityResolver(registry, [adapter]);

    const result = await resolver.execute("work.deal_read", {}, {
      orgId: "org-1",
      actorId: "actor-2",
      requestId: "req-3",
      allowedCapabilityIds: ["work.underwrite"]
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("actor_not_allowed");
  });

  it("emits telemetry for failed provider attempts and final success", async () => {
    const events: CapabilityExecutionTelemetryEvent[] = [];
    const primary: CapabilityProviderAdapter = {
      providerId: "primary",
      execute: async () => {
        throw new Error("boom");
      }
    };
    const fallback: CapabilityProviderAdapter = {
      providerId: "fallback",
      execute: async () => ({ ok: true })
    };
    const resolver = new RegistryCapabilityResolver(registry, [primary, fallback], {
      record: (event) => {
        events.push(event);
      }
    });

    const result = await resolver.execute("work.underwrite", {}, {
      orgId: "org-9",
      actorId: "actor-9",
      requestId: "req-9",
      approvalGranted: true
    });

    expect(result.status).toBe("completed");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      providerId: "primary",
      status: "failed",
      attempt: 1,
      orgId: "org-9",
      actorId: "actor-9"
    });
    expect(events[1]).toMatchObject({
      providerId: "fallback",
      status: "completed",
      attempt: 2
    });
  });
});
