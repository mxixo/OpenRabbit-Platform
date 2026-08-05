# Language Strategy
## Current language posture
TypeScript is the primary platform language and is currently appropriate for the implemented architecture.
Observed evidence:
- All runtime services, MCP layers, and core contracts are in strict TypeScript.
- CI and package scripts are optimized around Node + Vitest + `tsc`.
- Service patterns (contracts/lifecycle/reliability) are consistently modeled in TS interfaces.
## Why TypeScript is currently the right primary language
- Strong contract-first ergonomics across service boundaries.
- Unified runtime/tooling stack for services and client-facing layers.
- Lower cross-language integration friction at current maturity stage.
- Existing code quality gates and tests are TS-native.
## Areas naturally suited for TypeScript (keep as-is)
- Service contracts and core runtime interfaces.
- MCP protocol contracts/adapters/server logic.
- Orchestration and workflow execution services.
- Client service gateway layers and API-facing service logic.
- Shared reliability and observability primitives.
## Where Python could be introduced later (coexistence, not rewrite)
These are additive opportunities where Python is often strong and can coexist behind stable APIs:
- Data/ML ingestion pipelines in `knowledge/`:
  - large-batch ETL, offline embedding generation, feature extraction.
- Evaluation tooling in `evals/`:
  - experiment runners, benchmark orchestration, model analysis notebooks.
- Advanced retrieval/ranking experimentation:
  - R&D prototypes that eventually publish stable outputs to TS services.
- Integration adapters that already rely on Python-native ecosystems:
  - only where there is clear library leverage and operational justification.
## Where Python should not be introduced first
- Core request path services (`api-gateway`, `orchestrator`, `policy`, `mcp` request handling).
- Shared runtime contracts and service lifecycle foundations.
- Existing TypeScript services that already have stable interfaces/tests.
## Recommended coexistence model
- Keep TypeScript as the control plane/runtime services language.
- Introduce Python as isolated worker services for ML/data workloads.
- Integrate via explicit contracts:
  - HTTP/gRPC APIs or async job queues.
  - versioned schema contracts in `specs/`.
- Enforce clear ownership boundaries:
  - TS owns orchestration and API contracts.
  - Python owns bounded compute/data workloads.
## Why this avoids disruption
- No rewrites of working TypeScript modules.
- Preserves existing CI/build/deploy model while allowing specialized workers.
- Enables gradual capability expansion with measurable risk control.
## Recommendation
TypeScript should remain the primary platform language for OpenRabbit. Python should be introduced only in bounded, compute-heavy domains where it provides clear ecosystem or productivity advantages, and only behind stable cross-language contracts.
