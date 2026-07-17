# OpenRabbit/OpenClaw Migration Plan
## Scope
This document defines where each existing repository component will live in the hardened production workflow. It is a structural target map only; no source files are moved in this phase.

## Target placement by current component
### Platform architecture and governance
- `architecture/` → canonical platform architecture references (diagrams, contracts, decision context).
- `docs/architecture/` and `docs/adrs/` → executable design and decision records.
- `specs/` → source-of-truth technical contracts (OpenAPI, JSON Schema, MCP tool schemas).

### Product domains and intelligence layers
- `domains/` → business domain models and policies (core + real-estate vertical logic).
- `knowledge/` → knowledge subsystem (indexing, embeddings, graph, retrieval, vector storage, tenancy).
- `skills/` → reusable agent skill definitions and packaging metadata.
- `prompts/` → managed prompt assets segmented by system/compliance/workflow/vertical.

### Runtime and orchestration services
- `services/api-gateway/` → unified API entrypoint for OpenRabbit/OpenClaw clients.
- `services/orchestrator/` → workflow and multi-agent coordination control plane.
- `services/model-gateway/` → LLM provider routing, policy enforcement, and cost controls.
- `services/memory/` → short/long-term memory orchestration and persistence interfaces.
- `services/workflow-engine/` → execution runtime for deterministic + agentic workflows.
- `services/policy/` → guardrails, approvals, and compliance enforcement runtime.
- `services/cognition/` → planning/reasoning support services.
- `services/evals-service/` → evaluation job execution and scoring APIs.

### Protocol and integrations layer
- `mcp/servers/` → first-party MCP servers.
- `mcp/adapters/` → external system adapters exposed through MCP.
- `mcp/contracts/` → MCP schemas and protocol contracts.
- `integrations/` → provider/platform integrations (HubSpot, Telegram, browser relay, future connectors).

### Shared packages and SDK surface
- `packages/auth/` → shared authn/authz utilities.
- `packages/schemas/` → versioned shared schema library.
- `packages/observability/` → telemetry/logging/tracing utilities.
- `packages/sdks/` → internal/external SDK packages for service and client consumption.

### Clients and user-facing surfaces
- `clients/web/` → primary browser client.
- `clients/mobile/` → mobile client application(s).
- `clients/desktop/` → desktop application(s).

### Infrastructure, operations, and release
- `infra/` → IaC and environment definitions.
- `deploy/` → release/deployment assets and production checklists.
- `scripts/` → standardized automation for bootstrap, CI, dev, maintenance, and release operations.
- `runtime/` → ephemeral runtime artifacts (cache/logs/tmp/audit outputs, environment-specific).

### Quality and validation
- `tests/` → unit, integration, contract, and e2e suites.
- `evals/` → benchmark suites, golden traces, and failure corpora.
- `experiments/` → incubator and archived R&D work (not release-critical).

## OpenRabbit/OpenClaw convergence intent
- OpenRabbit remains the platform foundation (runtime, protocols, services, infra).
- OpenClaw remains the domain workflow layer (real-estate and GTM-specific prompts, skills, integrations, workflows).
- Integration point: OpenClaw capabilities are implemented as versioned modules on top of OpenRabbit service boundaries and shared contracts.

## Exit criteria for future migration phases
- Every active component has a single owning directory and clear interface contract.
- Shared contracts are versioned in `specs/` and consumed through `packages/schemas/` or `packages/sdks/`.
- Cross-cutting runtime concerns (security, observability, compliance) are centralized through `services/policy/`, `packages/observability/`, and deployment pipelines.
