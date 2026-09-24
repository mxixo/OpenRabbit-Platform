/**
 * Trusted execution-node registry contracts.
 *
 * A node is a capability-scoped execution surface (desktop, mobile, server, etc.).
 * Network reachability is transport metadata only and never grants task authority.
 */

export type ExecutionNodeKind = "control-plane" | "server" | "desktop" | "mobile" | "other";
export type ExecutionNodeHealth = "online" | "stale" | "offline";

export interface ExecutionNodeNetworkIdentity {
  /** Stable identity supplied by the private connectivity fabric, when available. */
  fabricNodeId?: string;
  /** Human-readable device name from the connectivity fabric. */
  deviceName?: string;
  /** Private addresses only; callers must not infer authority from addressability. */
  privateAddresses?: string[];
  /** Routing capability such as exit-node availability is informational only. */
  advertisesExitNode?: boolean;
}

export interface ExecutionNodeRecord {
  nodeId: string;
  orgId: string;
  kind: ExecutionNodeKind;
  displayName: string;
  runtimeVersion: string;
  capabilities: string[];
  network?: ExecutionNodeNetworkIdentity;
  enabled: boolean;
  registeredAt: string;
  lastSeenAt: string;
  /** Explicitly reported unavailable state, independent of heartbeat age. */
  reportedOffline?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ExecutionNodeHeartbeat {
  nodeId: string;
  orgId: string;
  observedAt: string;
  runtimeVersion?: string;
  capabilities?: string[];
  network?: ExecutionNodeNetworkIdentity;
  metadata?: Record<string, unknown>;
}

export interface ExecutionNodeView extends ExecutionNodeRecord {
  health: ExecutionNodeHealth;
}

export interface CapabilityRouteRequest {
  orgId: string;
  capability: string;
  /** Optional node kinds permitted for this task, in preference order. */
  preferredKinds?: ExecutionNodeKind[];
  /** Optional exact node allow-list imposed by policy. */
  allowedNodeIds?: string[];
}

export interface CapabilityRouteSelection {
  node: ExecutionNodeView;
  reason: "preferred_kind_online" | "capability_online";
}

export interface ExecutionNodeRegistry {
  register(record: ExecutionNodeRecord): void;
  unregister(orgId: string, nodeId: string): void;
  heartbeat(input: ExecutionNodeHeartbeat): ExecutionNodeView;
  setReportedOffline(orgId: string, nodeId: string, offline: boolean): ExecutionNodeView;
  get(orgId: string, nodeId: string): ExecutionNodeView | undefined;
  list(orgId: string): ExecutionNodeView[];
  resolveCapability(request: CapabilityRouteRequest): CapabilityRouteSelection;
}
