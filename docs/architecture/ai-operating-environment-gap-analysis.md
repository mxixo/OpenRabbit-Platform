# Gap Analysis: Current Architecture vs AI Operating Environment Vision

## Scope

This document reconciles the **existing** OpenRabbit Platform and OpenRabbit application repositories with the AI Operating Environment vision. It deliberately challenges prior implementation assumptions rather than rubber-stamping them.

Primary sources reviewed:

- `docs/architecture/current-platform-overview.md`
- `docs/architecture/dependency-map.md`
- `docs/architecture/service-catalog.md`
- `docs/architecture/technical-debt.md`
- `packages/runtime-core` interfaces
- `services/*` contracts
- OpenRabbit app skill runner (`createOpenClawSkillRunner`) and commercial workflow MVP
- OpenRabbit app `docs/migration-plan.md`

## Executive verdict

The current codebase is a **strong modular control-plane foundation**, not yet an AI operating environment product.

Keep:

- interface-first services
- runtime-core primitives
- MCP layering
- deterministic workflow-engine
- declarative deploy policy

Change:

- product framing and glossary
- OpenClaw coupling at the product edge
- missing Worker / RuntimeProvider / CapabilityModule abstractions
- dual workflow ownership
- placeholder capability and pack surfaces
- dual-repo ownership ambiguity (app vs platform)

## Alignment matrix

| Vision requirement | Current state | Fit | Notes |
|---|---|---|---|
| Runtime-agnostic platform | No `RuntimeProvider`; OpenClaw named in app entrypoints | Weak | Platform services are mostly runtime-neutral, but product edge is OpenClaw-branded |
| Configurable AI workers | `AgentRegistry` + skills service exist; no worker role model | Partial | Agents/skills are primitives, not employee configurations |
| Layered CX / Core / Runtime / Capability / Integrations | Service-centric layout with scaffold dirs | Partial | Layers are implied, not enforced or named |
| Installable capabilities | `domains/`, `integrations/`, `skills/` mostly placeholders | Weak | Commercial workflow lives as an app skill, not a capability module |
| Industry packs | Conceptual only | Missing | Real-estate content exists as workflow MVP, not a pack |
| Orchestration over reimplementation | MCP + model gateway abstractions help | Partial | Still easy to rebuild domain logic inside skills |
| Frontend independence | `services/clients` channel descriptors only | Partial | No stable public product API surface for Horizons/other UIs |
| Multi-worker scale path | In-memory orchestrator/task intake | Partial | Contracts are good; durability and scheduling are not |
| Avoid vendor lock-in | OpenClaw naming + single runtime path risk | Weak at edge | Core packages are cleaner than the app façade |

## What already supports the vision

### 1. Interface-first control plane

`packages/runtime-core` already centralizes useful platform primitives:

- configuration, DI, event bus, logging
- permissions
- tool registry
- agent registry and agent state events
- model provider interface
- memory and knowledge interfaces
- MCP client interface
- reflection loop hooks
- service reliability snapshots

**Why this matters:** these are control-plane building blocks for an operating environment, not chatbot glue.

### 2. Service boundary pattern

Implemented services share a healthy pattern:

- contracts first
- lifecycle (`start` / `stop` / health)
- deterministic error codes
- reliability snapshots
- unit tests

This pattern should be preserved and elevated into platform modules rather than replaced.

### 3. MCP as an integration boundary

The `mcp/contracts` → `mcp/adapters` → `mcp/servers` split is aligned with Layer 5. MCP should remain an **integration protocol**, not the product identity.

### 4. Workflow engine kernel

`services/workflow-engine` already behaves like a deterministic execution kernel with guardrails, retries, and timelines. That is the correct kernel shape for org workflows supervised by workers.

### 5. Memory service maturity

Memory has repository + persistence adapter separation (in-memory and JSON-file). This is the right seam for durable org/worker memory later.

## Critical misalignments

### A. Product identity is still “orchestration platform + OpenClaw skills”

Current overview language frames OpenRabbit as an AI orchestration/MCP platform. The app entrypoint exposes `createOpenClawSkillRunner`.

**Risk:** customers, contributors, and future codepaths will treat OpenClaw as the product.

**Correction:** rename product language to Platform / Runtime / Worker. Keep OpenClaw only under runtime adapters.

### B. No first-class Worker object

Existing primitives:

- `AgentDefinition` / `AgentRegistry`
- `SkillsService` handlers
- commercial skill in the app repo

Missing:

- worker role presets
- org assignment
- capability allow-lists
- runtime preference per worker
- supervision / escalation policy as config

**Risk:** every new “employee” becomes custom code instead of configuration.

### C. No RuntimeProvider boundary

Model invocation is abstracted (`ModelProvider`), and MCP is abstracted (`McpClient`), but there is no runtime adapter that represents an external agent operating environment (session lifecycle, tool projection, event streaming, memory projection).

**Risk:** OpenClaw integration will leak into orchestrator/skills/workflows.

### D. Dual workflow surfaces without composition law

- `services/workflow-engine` = richer deterministic runner
- `services/workflows` = registry/dispatch façade scaffold

Without an explicit rule, both will grow execution logic.

**Correction:** engine = kernel; workflows service = platform façade/API.

### E. Capabilities and packs are not real modules yet

Strategic directories exist (`domains`, `integrations`, `knowledge`, `skills`) but are documentation-heavy. The highest-value domain asset (commercial investment workflow) lives in the app repo as a skill file.

**Risk:** industry expansion forks the app instead of installing packs onto core.

### F. Two repositories, unclear ownership

| Repo | Current role | Vision role |
|---|---|---|
| `OpenRabbit-Platform` | modular backend foundation | Platform core + runtimes + capabilities + integrations |
| `OpenRabbit` | skill scaffold + commercial MVP | Thin app/runtime host or fold into platform apps/capabilities |

**Risk:** duplicated concepts and divergent migration plans.

### G. CX layer is underspecified

`services/clients` knows channel types (`web` / `mobile` / `desktop`) but there is no product API contract for:

- org bootstrap
- worker management
- capability installation
- approval inbox
- CEO dashboard queries

Hostinger Horizons can build UI quickly only if these APIs are stable and backend-owned.

## Coupling hotspots (priority order)

1. **OpenRabbit app OpenClaw-named runner** — product-edge lock-in
2. **Missing runtime/worker/capability contracts** — conceptual debt that blocks scale
3. **Workflow dual ownership** — behavioral drift risk
4. **Domain logic in app skills** — blocks pack model
5. **In-memory control plane defaults** — acceptable now; dangerous if APIs solidify around them
6. **Package boundary / CI issues** — engineering reliability (PR #13 type resolution failure shows monorepo packaging still fragile)

## Preserve vs replace vs demote

| Asset | Decision | Rationale |
|---|---|---|
| `packages/runtime-core` | **Preserve and extend** | Right place for platform contracts |
| `services/api-gateway`, `policy`, `memory`, `model-gateway` | **Preserve** as core services | Map cleanly into Layer 2 |
| `services/orchestrator` | **Preserve, re-scope** | Become worker/task orchestrator over RuntimeProvider |
| `services/skills` | **Preserve as tool/skill registry substrate** | Not the same thing as workers |
| `services/workflow-engine` | **Preserve as kernel** | Deterministic execution is core |
| `services/workflows` | **Preserve as façade** | Needs explicit composition contract |
| `mcp/*` | **Preserve as integration stack** | Layer 5, not product brand |
| OpenClaw skill runner name/API | **Demote** | Adapter-only |
| Commercial investment skill in app | **Migrate** into real-estate capability/pack | Enables industry model |
| Placeholder dirs | **Fill with manifests**, don’t delete | Keep extension points |
| Hostinger Horizons | **Client only** | Never core |

## Implications for prior roadmap assumptions

Prior phase language (Phase 10 CI hardening, Phase 11 durable adapters, Phase 12 integrations) remains useful **engineering** work, but is insufficient as a **product architecture** roadmap.

Those phases should be reframed under the vision roadmap:

- boundary contracts and glossary first
- runtime demotion second
- workers and capabilities third
- durable adapters and real integrations as scale foundations

Otherwise the team will harden the wrong shape efficiently.

## Bottom line

OpenRabbit today is closest to:

> a well-structured TypeScript control-plane monorepo with MCP and workflow kernels, plus an OpenClaw-flavored skill MVP.

The vision requires it to become:

> a runtime-agnostic operating environment where configurable AI workers run organizations through installable capabilities and industry packs.

The gap is mostly **product architecture and boundaries**, not a need to throw away the service foundation.
