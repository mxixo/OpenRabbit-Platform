import type {
  CapabilityRouteRequest,
  CapabilityRouteSelection,
  ExecutionNodeHeartbeat,
  ExecutionNodeHealth,
  ExecutionNodeRecord,
  ExecutionNodeRegistry,
  ExecutionNodeView,
} from "../interfaces/node-registry.js";

export interface InMemoryExecutionNodeRegistryOptions {
  staleAfterMs?: number;
  offlineAfterMs?: number;
  now?: () => Date;
}

function parseTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be an ISO-8601 timestamp`);
  }
  return parsed;
}

function normalizeCapabilities(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length !== values.length) {
    throw new Error("node capabilities must be non-empty strings");
  }
  return [...new Set(normalized)].sort();
}

function cloneRecord(record: ExecutionNodeRecord): ExecutionNodeRecord {
  return {
    ...record,
    capabilities: [...record.capabilities],
    network: record.network
      ? {
          ...record.network,
          privateAddresses: record.network.privateAddresses
            ? [...record.network.privateAddresses]
            : undefined,
        }
      : undefined,
    metadata: record.metadata ? structuredClone(record.metadata) : undefined,
  };
}

/**
 * Reference registry for trusted execution nodes.
 *
 * Production deployments should back this contract with durable storage and
 * authenticated node heartbeats. This implementation deliberately fails closed:
 * stale/offline/disabled/cross-org nodes are never selected for execution.
 */
export class InMemoryExecutionNodeRegistry implements ExecutionNodeRegistry {
  private readonly records = new Map<string, ExecutionNodeRecord>();
  private readonly staleAfterMs: number;
  private readonly offlineAfterMs: number;
  private readonly now: () => Date;

  constructor(options: InMemoryExecutionNodeRegistryOptions = {}) {
    this.staleAfterMs = options.staleAfterMs ?? 60_000;
    this.offlineAfterMs = options.offlineAfterMs ?? 5 * 60_000;
    this.now = options.now ?? (() => new Date());
    if (this.staleAfterMs <= 0 || this.offlineAfterMs <= this.staleAfterMs) {
      throw new Error("offlineAfterMs must be greater than staleAfterMs and both must be positive");
    }
  }

  private key(orgId: string, nodeId: string): string {
    return `${orgId}\u0000${nodeId}`;
  }

  private validateIdentity(orgId: string, nodeId: string): void {
    if (!orgId.trim() || !nodeId.trim()) {
      throw new Error("orgId and nodeId are required");
    }
  }

  private health(record: ExecutionNodeRecord): ExecutionNodeHealth {
    if (!record.enabled || record.reportedOffline) return "offline";
    const ageMs = this.now().getTime() - parseTimestamp(record.lastSeenAt, "lastSeenAt");
    if (ageMs < 0) throw new Error("node lastSeenAt cannot be in the future");
    if (ageMs >= this.offlineAfterMs) return "offline";
    if (ageMs >= this.staleAfterMs) return "stale";
    return "online";
  }

  private view(record: ExecutionNodeRecord): ExecutionNodeView {
    const cloned = cloneRecord(record);
    return { ...cloned, health: this.health(cloned) };
  }

  register(input: ExecutionNodeRecord): void {
    this.validateIdentity(input.orgId, input.nodeId);
    if (!input.displayName.trim() || !input.runtimeVersion.trim()) {
      throw new Error("displayName and runtimeVersion are required");
    }
    const registeredAt = parseTimestamp(input.registeredAt, "registeredAt");
    const lastSeenAt = parseTimestamp(input.lastSeenAt, "lastSeenAt");
    if (lastSeenAt < registeredAt) {
      throw new Error("lastSeenAt cannot predate registeredAt");
    }
    if (lastSeenAt > this.now().getTime()) {
      throw new Error("lastSeenAt cannot be in the future");
    }

    const key = this.key(input.orgId, input.nodeId);
    if (this.records.has(key)) {
      throw new Error(`execution node already registered: ${input.nodeId}`);
    }
    this.records.set(
      key,
      cloneRecord({ ...input, capabilities: normalizeCapabilities(input.capabilities) }),
    );
  }

  unregister(orgId: string, nodeId: string): void {
    this.validateIdentity(orgId, nodeId);
    this.records.delete(this.key(orgId, nodeId));
  }

  heartbeat(input: ExecutionNodeHeartbeat): ExecutionNodeView {
    this.validateIdentity(input.orgId, input.nodeId);
    const key = this.key(input.orgId, input.nodeId);
    const current = this.records.get(key);
    if (!current) throw new Error(`execution node is not registered: ${input.nodeId}`);

    const observedAt = parseTimestamp(input.observedAt, "observedAt");
    const previous = parseTimestamp(current.lastSeenAt, "lastSeenAt");
    if (observedAt < previous) {
      throw new Error("heartbeat observedAt cannot move backwards");
    }
    if (observedAt > this.now().getTime()) {
      throw new Error("heartbeat observedAt cannot be in the future");
    }

    const updated: ExecutionNodeRecord = {
      ...current,
      lastSeenAt: input.observedAt,
      runtimeVersion: input.runtimeVersion?.trim() || current.runtimeVersion,
      capabilities: input.capabilities
        ? normalizeCapabilities(input.capabilities)
        : [...current.capabilities],
      network: input.network
        ? {
            ...input.network,
            privateAddresses: input.network.privateAddresses
              ? [...input.network.privateAddresses]
              : undefined,
          }
        : current.network,
      metadata: input.metadata ? structuredClone(input.metadata) : current.metadata,
      reportedOffline: false,
    };
    this.records.set(key, updated);
    return this.view(updated);
  }

  setReportedOffline(orgId: string, nodeId: string, offline: boolean): ExecutionNodeView {
    this.validateIdentity(orgId, nodeId);
    const key = this.key(orgId, nodeId);
    const current = this.records.get(key);
    if (!current) throw new Error(`execution node is not registered: ${nodeId}`);
    const updated = { ...current, reportedOffline: offline };
    this.records.set(key, updated);
    return this.view(updated);
  }

  get(orgId: string, nodeId: string): ExecutionNodeView | undefined {
    this.validateIdentity(orgId, nodeId);
    const record = this.records.get(this.key(orgId, nodeId));
    return record ? this.view(record) : undefined;
  }

  list(orgId: string): ExecutionNodeView[] {
    if (!orgId.trim()) throw new Error("orgId is required");
    return [...this.records.values()]
      .filter((record) => record.orgId === orgId)
      .map((record) => this.view(record))
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  resolveCapability(request: CapabilityRouteRequest): CapabilityRouteSelection {
    const capability = request.capability.trim();
    if (!request.orgId.trim() || !capability) {
      throw new Error("orgId and capability are required for capability routing");
    }
    const allow = request.allowedNodeIds ? new Set(request.allowedNodeIds) : undefined;
    const candidates = this.list(request.orgId).filter(
      (node) =>
        node.health === "online" &&
        node.enabled &&
        node.capabilities.includes(capability) &&
        (!allow || allow.has(node.nodeId)),
    );
    if (candidates.length === 0) {
      throw new Error(`no online execution node can satisfy capability: ${capability}`);
    }

    const preferences = request.preferredKinds ?? [];
    const kindRank = (node: ExecutionNodeView): number => {
      const rank = preferences.indexOf(node.kind);
      return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
    };
    candidates.sort((a, b) => {
      const preferenceDelta = kindRank(a) - kindRank(b);
      if (preferenceDelta !== 0) return preferenceDelta;
      const heartbeatDelta = Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
      if (heartbeatDelta !== 0) return heartbeatDelta;
      return a.nodeId.localeCompare(b.nodeId);
    });

    const node = candidates[0];
    return {
      node,
      reason: kindRank(node) !== Number.MAX_SAFE_INTEGER
        ? "preferred_kind_online"
        : "capability_online",
    };
  }
}
