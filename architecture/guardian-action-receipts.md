# Guardian + Action Receipt contract

Status: implementation contract for runtime-core. This document describes the minimum trust/provenance boundary for consequential OpenRabbit actions; it does not certify any provider for production use.

## Execution order

Consequential execution follows a fail-closed sequence:

1. resolve the authenticated organization/user and command origin;
2. resolve the exact required capability set for the requested action;
3. compare required capabilities with backend-authoritative grants;
4. evaluate anomaly, risk, identity freshness, reversibility, external visibility/write intent, and provider authorization in the Guardian;
5. obtain reauthentication or confirmation only when the policy outcome requires it;
6. execute through the selected provider/runtime path;
7. verify or reconcile the external effect when applicable;
8. append an Action Receipt containing the authority/provenance/effect evidence.

A model or worker may propose an action but it does not grant itself authority. Missing capability authority, explicit provider prohibition, or anomalous command provenance fails closed before the side effect.

## Action Receipt v1

An Action Receipt is append-only evidence for a completed or attempted action. It records:

- tenant (`orgId`), action, task and timestamp identity;
- actor type, command origin, worker/device identity, parent receipt and delegation chain;
- Guardian decision, policy version, risk tier, required capabilities, capability snapshot and approval reference;
- provider, execution mode, provider-authorization state, provider request/receipt identifiers and observation time;
- exposed context categories (categories only, not secret/customer payloads by default);
- whether the action is externally visible/reversible and the effect status;
- optional input/output digests and bounded metadata.

`effectStatus=confirmed` for a provider-mediated action requires a provider request identifier or external receipt identifier. Provider success is not inferred from a model statement.

The in-memory reference store returns defensive copies and rejects duplicate receipt IDs. Runtime-core now also exposes a deterministic SHA-256 sealing primitive that canonicalizes a receipt, can bind a receipt to the preceding receipt hash, and verifies that later mutation changes the seal. This is a tamper-evidence building block, **not** a durable ledger by itself. Production persistence must store seals outside worker authority and still provide durable ordering, retention, redaction/export policy, disaster recovery, and integrity verification after restore.

## Provider execution modes

Receipts distinguish `native_api`, `mcp`, `browser`, `local_runtime`, and `human`. This is intentionally separate from capability authority. A user can authorize an OpenRabbit capability while the external provider still disallows a particular execution method.

Preferred execution selection remains:

1. provider-authorized native/agent interface;
2. API or MCP path with provider-authoritative authorization;
3. explicitly permitted browser/computer-use path;
4. local runtime for local-only actions;
5. human delegation only when explicitly disclosed/authorized.

The Guardian must not treat browser reachability as provider authorization.

An external write with explicit provider denial is blocked. If provider authorization is unknown, the reversible-only lane is available **only when reversibility has been affirmatively established**. Unknown provider authorization plus an irreversible or unproven-reversible external write fails closed instead of relying on a low-risk label or user confirmation to make the path acceptable.

## Capability contract rule

Connector capability contracts should resolve to action-level authority, not a single broad `connected=true` state. Read and write authority must be separable, and consequential write actions should identify the minimum required capability set in the receipt.

Examples:

- `mail.search` / `mail.read` are distinct from `mail.send`;
- `calendar.read` is distinct from `calendar.create_event` / `calendar.update_event`;
- commerce-style integrations should distinguish discovery/cart preparation from transaction execution;
- a future financial transaction capability must additionally bind amount/merchant/category/recurrence constraints rather than relying on generic connector access.

## Adversarial invariants

Release tests should preserve these invariants:

- cross-tenant receipt reads return no evidence;
- callers cannot mutate stored receipt evidence through returned object references;
- duplicate receipt identity is rejected;
- receipt sealing is deterministic and detects mutation of policy/capability/provenance/effect evidence;
- a chained receipt seal changes when the previous receipt identity/hash changes;
- missing required capabilities block execution;
- an explicitly unauthorized provider execution path blocks execution;
- unknown provider authorization blocks an irreversible or unproven-reversible external write;
- command-origin anomalies block execution even when capabilities are otherwise present;
- high-risk actions require fresh strong identity and then explicit confirmation for externally visible/write effects;
- unknown provider authorization cannot silently become unrestricted write permission.

These runtime-core tests are necessary but not sufficient for production certification. Hosted tenant isolation, provider lifecycle, durable receipt/seal storage, multi-host ordering, restore-time integrity checks, incident response and adversarial end-to-end tests remain required by the production release ladder.
