# Tenant Isolation & Idempotency Reliability Contract

Status: Day-2 production-readiness foundation. This document defines the workflow-engine reliability contract; it does not claim that the current in-memory reference store is production persistence.

## Why this exists

OpenRabbit can execute consequential workflows against connected systems. Retries, reconnects, duplicated requests, and concurrent organizations must not cause one tenant's completed action to be replayed for another tenant or cause an already-completed side effect to run again accidentally.

## Idempotency scope

When idempotency is requested, both `tenantId` and `idempotencyKey` are required. The canonical scope is:

`tenantId + workflowId + workflowVersion + idempotencyKey`

Consequences:

- the same key is isolated between tenants;
- a new workflow version does not silently inherit a prior version's completion result;
- a completed retry in the same tenant/version can be replayed without re-executing handlers;
- partially specified scope fails closed before any workflow action executes.

## Replay semantics

Only successfully completed workflows are eligible for idempotent replay. Blocked or failed attempts are not cached as completed work. A replay emits `workflow.replayed` so the audit trail can distinguish a returned prior completion from a new execution.

Workflows that do not provide an idempotency scope retain the prior execution behavior. This preserves compatibility while allowing connectors and workflow templates to opt into deterministic de-duplication as they are hardened.

## Tenant-isolation matrix

| Case | Expected behavior |
| --- | --- |
| Same tenant + workflow + version + key | Replay prior completed result; do not invoke handlers again |
| Different tenant + same workflow/version/key | Execute independently |
| Same tenant + same workflow/key + new version | Execute independently |
| Key without tenant | Fail before side effects |
| Tenant without key | Fail before side effects |
| No tenant and no key | Legacy non-idempotent execution |

## Current implementation boundary

`InMemoryWorkflowIdempotencyStore` is a deterministic reference implementation for tests and single-process development. Production deployment still requires a durable, concurrency-safe backing store with atomic claim/complete semantics, retention policy, tenant-aware access control, and observability.

The reference layer deliberately establishes the key contract now so a durable Redis/Postgres implementation can replace storage without changing workflow identity semantics.

## Production follow-ons

1. Add an atomic `claim -> execute -> complete` store implementation so concurrent duplicate requests cannot both begin side effects.
2. Define connector-specific idempotency-key derivation for writes such as email send, calendar mutation, CRM update, document write, and external API actions.
3. Add retention/expiry rules based on workflow risk and external-provider retry windows.
4. Emit metrics for new execution, replay, collision, scope error, failed execution, and storage failure.
5. Exercise the matrix against a durable store in CI/integration tests and during restart/recovery testing.
