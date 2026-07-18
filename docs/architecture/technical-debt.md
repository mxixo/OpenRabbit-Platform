# Technical Debt Register
## Critical
### 1) CI quality gates exclude several implemented packages
Reason
- `scripts/ci/run-quality-gates.sh` does not currently run tests/typecheck for newer packages (`mcp/adapters`, `services/memory`, `services/skills`, `services/workflows`, `services/clients`).
Risk
- Regressions can be merged without centralized CI detection.
Suggested solution
- Extend quality gate script to include all implemented packages and keep list in one authoritative manifest.
Estimated effort
- Small to Medium.
### 2) Cross-package imports target `src/` internals via deep relative paths
Reason
- Services/MCP imports directly reference `packages/runtime-core/src/index.js` and similar internals.
Risk
- Weak package boundaries, brittle refactors, and hidden coupling.
Suggested solution
- Adopt workspace package resolution and import from package entrypoints.
Estimated effort
- Medium.
## High
### 3) Workflow responsibilities split across `workflow-engine` and `workflows` without explicit composition contract
Reason
- Both components model workflow execution-related concerns with partial overlap.
Risk
- Divergent behavior and duplicated logic over time.
Suggested solution
- Document and enforce one layer as execution kernel and the other as façade/orchestration boundary.
Estimated effort
- Medium.
### 4) Security policy and secrets controls are mostly declarative without enforcement hooks
Reason
- Strong policy docs exist, but runtime enforcement integrations are limited.
Risk
- False confidence in production security posture.
Suggested solution
- Add automated policy conformance checks in CI/release pipeline and runtime policy assertions.
Estimated effort
- Medium to Large.
### 5) Production deployment script is simulation-oriented
Reason
- `scripts/release/deploy-prod.sh` validates and simulates stages but does not execute backend deploy commands.
Risk
- Operational runbooks can drift from actual deployment mechanics.
Suggested solution
- Integrate environment-specific deployment executors while preserving dry-run mode.
Estimated effort
- Medium.
## Medium
### 6) Runtime implementations are mostly in-memory (except memory JSON-file option)
Reason
- Architecture intentionally started with in-process defaults.
Risk
- Limited horizontal scalability and persistence guarantees.
Suggested solution
- Add durable adapters behind existing interfaces (datastore, queue, event stream) incrementally.
Estimated effort
- Large.
### 7) Placeholder-heavy strategic directories (`knowledge`, `integrations`, `domains`, `specs`, `tests`)
Reason
- Phase sequencing left several directories at documentation-only maturity.
Risk
- Architectural intent is clear but implementation depth is uneven.
Suggested solution
- Phase-based introduction of contracts + minimal executable baselines per directory.
Estimated effort
- Medium.
### 8) Observability not centrally aggregated
Reason
- Structured logs/events exist in-process but no centralized sink/metrics/tracing pipeline.
Risk
- Limited incident diagnostics and SLO tracking.
Suggested solution
- Add observability package/adapters and standard telemetry schema.
Estimated effort
- Medium to Large.
## Low
### 9) Root-level developer UX is fragmented
Reason
- No single root orchestrator script for test/typecheck across all packages.
Risk
- Inconsistent local verification workflows.
Suggested solution
- Add root-level task runner script that mirrors CI checks.
Estimated effort
- Small.
### 10) Security and governance docs are concise placeholders
Reason
- `SECURITY.md` and some governance docs are intentionally minimal.
Risk
- Onboarding and compliance audit friction.
Suggested solution
- Expand policy/process docs without changing runtime behavior.
Estimated effort
- Small.
## Debt trend summary
- Architecture debt is currently more operational and boundary-oriented than algorithmic.
- Core patterns (contracts, lifecycle, deterministic errors, tests) are strong and should be preserved.
- Highest ROI comes from CI coverage expansion, boundary hardening, and explicit workflow layering.
