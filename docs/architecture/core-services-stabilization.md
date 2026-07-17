# Core Services Stabilization
## Purpose
Phase 2 stabilizes core services by introducing consistent service contracts and shared reliability patterns across:
- `services/api-gateway`
- `services/orchestrator`
- `services/model-gateway`
- `services/policy`

## Shared reliability patterns
Shared primitives were added in `packages/runtime-core`:
- `ServiceOperationResult<T>` for safe operation outcomes
- `ServiceReliabilitySnapshot` for per-service success/failure telemetry
- `RetryPolicy` and `withRetry()` for deterministic retry behavior

## Service-level stabilization changes
- `api-gateway`
  - Added safe `handleRequest()` path with validation, authorization, and event emission.
  - Added reliability snapshot counters and last-error tracking.
- `orchestrator`
  - Added idempotent task intake behavior for duplicate `taskId`.
  - Added reliability snapshot counters for task/MCP dispatch outcomes.
- `model-gateway`
  - Added `invokeModelSafe()` returning structured operation results.
  - Added retry-backed model invocation via shared `withRetry()`.
  - Added reliability snapshot counters and safe/unsafe invocation split.
- `policy`
  - Added `evaluateSafe()` returning structured operation results.
  - Added reliability snapshot counters and validation of policy input shape.

## Expected outcomes
- Core services now expose safer operational semantics for callers.
- Reliability telemetry is consistent and queryable per service.
- Retry behavior is centralized and reusable through runtime-core.
