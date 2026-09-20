# Production Release Gate Status

Status date: 2026-09-20. This tracker is evidence-based and intentionally conservative: a gate is not marked closed merely because a design document or unit test exists.

Source of gates: `docs/PRODUCTION_COMMERCIAL_READINESS.md`.

| Release gate | Status | Evidence present | Evidence still required before closure |
| --- | --- | --- | --- |
| No cross-tenant reads/writes | OPEN / PARTIAL FOUNDATION | Workflow idempotency scope now includes tenant + workflow + version + key, with tests proving identical keys do not replay across tenants. | End-to-end tenant isolation across persistence, connectors, caches, receipts, APIs, background jobs, and negative/adversarial tests. |
| Secrets never projected to worker models | OPEN / EVIDENCE REQUIRED | Existing architecture/policy work may constrain capabilities, but this tracker has not verified a complete secret-flow proof. | Secret inventory, projection tests, redaction/egress tests, connector credential boundary tests, and incident-safe logging verification. |
| External writes are idempotent and provider-verified | OPEN / PARTIAL FOUNDATION | Workflow engine has a deterministic idempotency identity contract and completed-result replay behavior. | Durable atomic claim/complete store, connector-specific keys, provider-side verification, replay-safe write adapters, restart/concurrency tests. |
| Retry does not duplicate external effects | OPEN / PARTIAL FOUNDATION | Completed in-memory workflow replays do not invoke handlers again. | Concurrent duplicate-request test, crash-after-provider-write recovery, process restart test, timeout ambiguity handling, provider reconciliation. |
| Policy engine cannot be bypassed by worker/runtime | OPEN / EVIDENCE REQUIRED | Policy/guardrail components exist in the workflow path. | Explicit bypass/adversarial suite across every external-write route and runtime/provider path. |
| Provenance answers are deterministic from receipts | OPEN / EVIDENCE REQUIRED | Receipt/provenance primitives exist elsewhere in the platform. | Golden tests that reconstruct user-visible provenance deterministically from stored receipts across restart/version changes. |
| Revoke/reconnect/account-mismatch flows pass | OPEN / EVIDENCE REQUIRED | No closure claim recorded here. | Automated provider lifecycle tests covering revoke, expiry, reconnect, wrong account, permission reduction, and recovery. |
| Backup/restore and runtime restart drills pass | OPEN / EVIDENCE REQUIRED | No closure claim recorded here. | Documented backup policy plus tested restore drill, state consistency check, runtime restart/recovery drill, and recovery objectives. |
| Production monitoring and incident path exist | OPEN / EVIDENCE REQUIRED | CI provides build/test signal but is not production observability. | Runtime metrics, structured error taxonomy, traces/log correlation, alerts, ownership/escalation, incident playbook, rollback procedure. |
| Public claims match actually validated capabilities | OPEN / CONTINUOUS GATE | Project documents distinguish foundations from production-ready behavior. | Pre-release claims inventory mapped to passing acceptance evidence; block unsupported reliability, security, automation, and performance claims. |

## Gate-closing rule

A release gate can move to **CLOSED** only when all of the following are attached or linked: (1) implementation evidence, (2) automated or reproducible acceptance evidence, (3) failure-path evidence, and (4) operational evidence where the gate depends on deployed behavior. Documentation alone is not closure.

## Immediate reliability sequence

1. Replace the reference in-memory idempotency store with a durable, concurrency-safe atomic claim/complete implementation.
2. Define connector-specific idempotency-key derivation and provider verification for external writes.
3. Add duplicate/concurrent/restart/crash-window tests before claiming retry safety.
4. Add tenant-negative tests across persistence and connector boundaries.
5. Add production observability and incident/rollback evidence, then re-evaluate this matrix.
