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
- Add agent memory foundations with confidence, freshness, and consolidation hooks.

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

## Memory and autonomous cognition refinement
To support long-term autonomous business agents (not only CRM retrieval), memory and cognition capabilities are phased so interfaces are stable early while higher-order learning behavior is introduced after observability and governance mature.

### Phase 4 (memory substrate)
- Agent memory
  - Establish tenant-safe working and long-term memory boundaries for each agent identity and session lineage.
- Memory confidence scoring
  - Persist confidence metadata for memory writes and retrieval ranking with deterministic scoring inputs.
- Memory decay and freshness
  - Attach recency/freshness metadata and policy-driven decay windows so stale memory can be deprioritized.
- Memory consolidation
  - Add promotion hooks to move frequently accessed working memory into long-term stores using explicit consolidation policies.

### Later phases (knowledge, skill adaptation, and provenance)
- Phase 5: Knowledge graph/entity relationships
  - Add entity and relationship layers over memory artifacts for cross-record reasoning and graph traversal.
- Phase 5: World knowledge separation from user/business memory
  - Enforce storage and retrieval partitioning between global world models and tenant/business facts.
- Phase 6: Skill and experience memory per agent
  - Add per-agent skill-performance and experience traces that inform capability routing and tool selection.
- Phase 7: Reasoning history and decision provenance
  - Persist reasoning traces, evidence references, and decision lineage for auditability and replay.
- Phase 7: Event sourcing for reconstructing historical agent state
  - Introduce append-only domain events for replaying agent state transitions and timeline forensics.
- Phase 8: Reflection loops for continuous agent improvement
  - Add governed self-reflection loops that use prior outcomes and eval signals to update strategies safely.

## Modular architecture constraints for future phases
- Keep memory, knowledge, skills, and workflow provenance as separable modules behind versioned contracts.
- Prefer additive schemas/events over breaking rewrites so autonomous agents can share and learn across phases.
- Keep policy/approval boundaries independent from storage engines so governance can evolve without memory refactors.
