# Technical Debt Register
## Critical
### 1) CI quality gates exclude several implemented packages
- **Severity**: Resolved (2026-08-05)
- **Evidence**: Earlier quality-gate scope omitted newer packages. Current `scripts/ci/run-quality-gates.sh` includes `mcp/adapters`, `services/memory`, `services/skills`, `services/workflows`, and `services/clients` alongside core packages.
- **Resolution**: Active TypeScript package list now covers the implemented service/MCP surface used in CI.
- **Residual risk**: Placeholder services without package manifests (`services/cognition`, `services/evals-service`) remain outside gates until scaffolded.
- **Effort**: Completed