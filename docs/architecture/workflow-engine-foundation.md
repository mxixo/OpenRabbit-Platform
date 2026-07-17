# Workflow Engine Foundation
## Purpose
Phase 7 introduces a foundational workflow engine for production templates, orchestration guardrails, and deterministic execution outcomes.

## Boundaries
- Engine implementation: `services/workflow-engine`
- Declarative workflow templates: `workflows/templates`
- Shared runtime dependencies: `packages/runtime-core`
- Orchestration integration point: `services/orchestrator`

The workflow engine remains in-process and transport/provider-agnostic in this phase.

## Core model
### Workflow definitions
Workflows are declarative definitions composed of ordered steps:
- `id`, `name`, `action`
- step guardrails (`policyCheck`, `requiresApproval`, `maxRetries`, optional timeout metadata)

### Execution contracts
Execution includes:
- contextual inputs (`correlationId`, initiator, variables, approvals)
- normalized execution events for timeline observability
- deterministic terminal statuses: `completed`, `blocked`, `failed`
- dead-letter reason when execution fails irrecoverably

## Guardrail model
- Policy pre-check guardrail flag (hook-ready)
- Human approval gate per step
- Retry guardrail (`maxRetries`) combined with runner retry policy cap
- Timeout metadata reserved for later transport/runtime enforcement

## Failure recovery primitives
- Retry policy contract (`maxAttempts`, optional backoff metadata)
- Dead-letter outcome fields in execution result
- Event timeline captures failure location and reason for replay/forensics

## Next-phase handoff
- Integrate policy service as active guardrail evaluator.
- Add persistent workflow state snapshots and resume semantics.
- Add execution telemetry sinks and metrics aggregation for SLO tracking.
