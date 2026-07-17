# Repository Roadmap
## Recommended implementation order
### Phase 1 Infrastructure
- Harden environments, IaC modules, secrets handling, and deployment baselines.
- Define branch protections, CI gates, and environment promotion rules.

### Phase 2 Core Services
- Stabilize API gateway, orchestrator, model gateway, and policy enforcement.
- Establish service contracts and shared reliability patterns.

### Phase 3 MCP
- Finalize MCP contracts, adapters, and first-party server lifecycle.
- Add compatibility tests for protocol/version negotiation.

### Phase 4 Memory
- Implement tenant-aware memory services and persistence abstractions.
- Add memory retention, retrieval quality, and governance controls.

### Phase 5 Knowledge
- Expand indexing/embedding/retrieval and knowledge graph pipelines.
- Standardize ingestion and semantic search validation.

### Phase 6 Skills
- Version and harden skill definitions, packaging, and execution boundaries.
- Add skill-level validation and rollback strategy.

### Phase 7 Workflows
- Implement production workflow templates and orchestration guardrails.
- Add workflow observability, approvals, and failure recovery playbooks.

### Phase 8 Clients
- Integrate web/mobile/desktop clients against stable APIs and SDKs.
- Validate end-to-end user journeys and release readiness.

### Phase 9 Production Deployment
- Execute staged rollout, runbooks, and incident response checks.
- Monitor SLOs, close operational gaps, and finalize GA release criteria.

## Phase dependencies
- Infrastructure is foundational for all subsequent phases.
- Core Services and MCP must be stable before Memory/Knowledge/Skills scale-out.
- Workflows depend on mature services, memory, and skills.
- Clients should target stable workflow and API surfaces.
- Production deployment requires all prior phase acceptance criteria.
