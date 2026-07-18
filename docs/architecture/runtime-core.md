# Runtime Core Architecture
## Purpose
`packages/runtime-core` defines the foundational runtime contracts and default local implementations used by future OpenRabbit services.

The package is intentionally interface-first:
- contracts in `src/interfaces/`
- default in-memory implementations in `src/core/`
- mock adapters in `src/mocks/`

## Core components
- Configuration Manager: layered config read/write with validation hooks.
- DI Container: token-based service registration and resolution with lifecycle control.
- Event Bus: in-process pub/sub with fault-isolated handlers.
- Logging: structured logger with pluggable sinks and contextual child loggers.
- Permission Manager: deterministic policy evaluator with deny precedence.
- Tool Registry: tool metadata + invocation registry.
- Agent Registry: agent metadata, capability, status, and tag lookup registry.
- Model Provider abstraction: provider-neutral model invocation contract.
- Memory interface:
  - namespace/session/agent-scoped memory CRUD + search contract
  - memory-domain support (`working`, `long-term`, `world`, `business`)
  - quality metadata envelope (confidence, freshness, decay, consolidation, provenance references)
  - quality-aware query filters (`domain`, `agentId`, `minConfidenceScore`)
- MCP interface: transport-agnostic MCP request/tool interaction contract.

## Boundaries and non-goals (Phase 5)
- No external API wiring or provider SDK integration.
- No persistence backends beyond in-memory implementations.
- No runtime network transport; MCP and model calls use mocks.

## Integration model
Future services should depend on runtime-core interfaces and inject implementations through the DI container. As production adapters are introduced, they should replace only implementation bindings, not interface contracts.

## Phase 4 memory substrate implementation (completed)
Phase 4 memory substrate capabilities are now implemented in runtime contracts and memory-service adapters:
- Domain-aware memory records and retrieval contracts.
- Confidence/freshness/decay metadata support for retrieval quality controls.
- Consolidation metadata and access-tracking hooks for working-to-long-term promotion.
- Stale/expired record de-prioritization behavior through decay metadata.

## Memory and cognition extension boundaries for later phases
To keep future phases modular and avoid major refactors, memory-related contracts should remain decomposed into additive capability interfaces:
- Memory domains
  - Partition interfaces for working memory, long-term memory, world knowledge, and tenant/business knowledge.
- Memory quality metadata
  - Standard metadata envelope for confidence, freshness timestamp, decay policy, and provenance reference IDs.
- Consolidation policy hooks
  - Strategy contract for promoting high-value working-memory items into long-term memory.
- Knowledge linkage adapters
  - Optional graph-link interface that can attach entity/relationship edges without coupling base memory CRUD to graph engines.
- Agent skill and experience traces
  - Separate agent-learning memory contract for capability outcomes, tool efficacy, and execution context.
- Reasoning and decision provenance
  - Trace contract for rationale summaries, cited evidence pointers, and decision lineage IDs.
- Event-sourced state timeline
  - Append-only state-transition event contract for replaying historical agent state.
- Reflection loop boundary
  - Governed feedback interface that consumes outcomes/evals and proposes policy-safe memory updates.

These boundaries should continue to evolve through additive contracts, with phase-appropriate implementations layered by memory, knowledge, skills, and workflow services.
