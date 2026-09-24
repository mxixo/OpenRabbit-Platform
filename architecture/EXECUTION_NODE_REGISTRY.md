# Execution Node Registry

OpenRabbit Core treats a connected device or server as a **capability-scoped execution surface**, not as another gateway and not as an implicit authority grant.

`ExecutionNodeRegistry` records stable node/org identity, node kind, runtime version, declared capabilities, private-network identity, enabled state, registration time and heartbeat time. Health is derived from authenticated liveness evidence rather than assumed from the fact that an address exists.

The reference `InMemoryExecutionNodeRegistry` fails closed for stale, offline, disabled and cross-org nodes. Capability routing can honor policy-provided node allow-lists and preferred node kinds, but it can select only an online node that explicitly declares the required capability. An advertised Tailscale exit-node role is network metadata only; it cannot create an OpenRabbit capability or bypass policy.

This slice establishes the contract and deterministic routing oracle for issue #81. It is intentionally **not** a production durability claim. Production still needs an authenticated heartbeat ingress, durable node state, execution-result verification/telemetry, restart/reconnect tests and explicit Tailscale ACL/grant documentation. One primary gateway/control plane remains the architecture; execution nodes add scoped capability, not redundant control planes.
