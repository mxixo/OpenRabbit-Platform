# Workflows
Business workflows composed from platform services and reusable primitives.
## Template catalog
Phase 7 foundation templates:
- `workflows/templates/lead-intake-workflow.json`
- `workflows/templates/compliance-review-workflow.json`
- `workflows/templates/transaction-close-workflow.json`

## Conventions
- Templates are declarative and provider-agnostic.
- Step actions reference abstract handlers resolved by the workflow engine.
- Guardrails are defined per step (approval gates, policy checks, retries, timeout metadata).
- Execution outcomes are deterministic (`completed`, `blocked`, `failed`) and produce timeline events for observability.
