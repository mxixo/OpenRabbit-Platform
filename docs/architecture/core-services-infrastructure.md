# Core Services Infrastructure
## Purpose
This document defines the initial infrastructure baseline for the Phase 2 core services:
- `services/api-gateway`
- `services/orchestrator`
- `services/model-gateway`
- `services/policy`

## Design decisions
- Interface-first service contracts per service (`src/contracts.ts`).
- Deterministic local bootstrap lifecycle (`start`, `stop`, `isStarted`, descriptor, health).
- Explicit startup context contract for dependency injection and deterministic overrides.
- Shared runtime dependencies sourced from `packages/runtime-core`.
- No external APIs or network listeners in this phase.

## Service baseline pattern
Each core service now includes:
- `src/contracts.ts` with service-specific request/response and lifecycle contracts.
- `src/service.ts` with bootstrap wiring using runtime-core abstractions.
- `src/index.ts` for stable exports.
- `tests/unit/service.test.ts` for lifecycle and behavior checks.
- local TypeScript and Vitest config for isolated execution.

## Responsibilities initialized
- `api-gateway`: request envelope validation + health reporting.
- `orchestrator`: task intake contract + in-memory event emission.
- `model-gateway`: provider-agnostic model invocation through mock provider bridge.
- `policy`: permission-evaluation adapter over runtime-core permission manager.
