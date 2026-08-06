# OpenRabbit Architecture

**Status:** Canonical architecture  
**Implements:** `docs/VISION.md`  
**Code anchors:** `packages/runtime-core`, `services/*`, `runtimes/*`, `capabilities/*`, `packs/*`, `mcp/*`

---

## 1. Architectural stance

OpenRabbit is a **layered, interface-first, API-first** platform.

- Prefer **orchestration** of existing services over reimplementation.
- Prefer **stable contracts** over framework fashion.
- Prefer **incremental migration** over big-bang rewrites.
- Keep **frontend, platform core, runtime, workers, tools, and external systems** separable.

---

## 2. Layered architecture

Dependency direction is **downward only**. Upper layers call lower layers through stable interfaces.

```text
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — Customer Experience                               │
│ Web · Mobile · CEO Dashboard · Client Portal · Auth UI      │
│ (Hostinger Horizons / any frontend is a client only)        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Public Platform API
┌───────────────────────────▼─────────────────────────────────┐
│ Layer 2 — OpenRabbit Core (control plane)                   │
│ Identity · Orgs · Permissions · Workers · Workflows         │
│ Memory · Tool/Plugin registry · API Gateway · Events·Audit  │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
┌───────────────▼──────────────┐  ┌───────────▼────────────────┐
│ Layer 3 — Runtime            │  │ Layer 4 — Capabilities     │
│ RuntimeProvider adapters     │  │ CRM · Email · Knowledge    │
│ OpenClaw · future runtimes   │  │ Real Estate · Finance · …  │
└───────────────┬──────────────┘  └───────────┬────────────────┘
                │                             │
                └──────────────┬──────────────┘
                               │
                 ┌─────────────▼──────────────┐
                 │ Layer 5 — Integrations     │
                 │ MCP · REST · GraphQL       │
                 │ Webhooks · OAuth · DBs     │
                 └────────────────────────────┘

Industry Packs compose Layers 3–5 presets (workers, capabilities, integrations, workflows).
```

### Layer responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| CX / Apps | UX, presentation, local form state | Business rules, secrets, direct DB, runtime SDKs |
| Core | Tenancy, authZ, worker orchestration, workflows façade, memory, tools registry, events, audit, public API | Industry business logic, concrete runtime SDKs |
| Runtime | Task/session execution for a worker | Org model, billing, industry packs |
| Capabilities | Domain tools/workflows/knowledge contributions | Platform identity, unrelated verticals |
| Integrations | Connector lifecycle and protocol translation | Product UX, worker HR model |

---

## 3. Core entities

Canonical TypeScript contracts live in `@openrabbit/runtime-core` unless noted.

| Entity | Meaning | Primary contract |
|---|---|---|
| Organization / User | Multi-tenant root | Future IAM module; policy seeds exist |
| RuntimeProvider | Pluggable execution engine | `RuntimeProvider` |
| Worker | Configurable AI employee | `WorkerDefinition`, `WorkerOrchestrator` |
| Tool | Callable capability | `ToolRegistry` / tool contributions |
| Workflow | Portable process | `workflow-engine` kernel + `workflows` façade |
| Capability module | Installable business module | `CapabilityModuleManifest`, `CapabilityManager` |
| Integration | External system adapter | `IntegrationAdapter` |
| Industry pack | Bundle of the above | `IndustryPackManifest`, `IndustryPackInstaller` |
| Memory record | Scoped durable/session knowledge | `MemoryStore` / memory service |
| Event / Audit | Operational and compliance trail | Event bus + future audit store |
| Permission / Policy | AuthZ decisions | Permission manager + policy service |

---

## 4. Data flow (happy path)

```text
CEO / App
  → API Gateway (authN/authZ, validation)
  → Worker Orchestrator
      → resolve WorkerDefinition
      → resolve RuntimeProvider via runtimePreference
      → project allow-listed tools + enabled capabilities
      → start/reuse RuntimeSession
      → RuntimeProvider.runTask(...)
  → optional Workflow façade → Workflow Engine kernel
  → Tools / Integrations / Memory
  → Events + Audit
  → response / approval request / report
```

Consequential side effects (spend money, send external comms, mutate production systems of record) pass **policy + human approval** gates before execution.

---

## 5. Runtime adapters

See `docs/RUNTIMES.md`.

- Core depends on `RuntimeProvider` only.
- OpenClaw implements the adapter under `runtimes/openclaw/`.
- Multiple runtimes may coexist; workers declare ordered preferences.
- Runtime health, capability discovery, and failure mapping are adapter concerns normalized to platform types.

---

## 6. Tool registry

- Tools are registered with name, schemas, tags, and handlers.
- Workers receive **projected** tool allow-lists per session.
- Capabilities contribute tools via manifests.
- Integrations may back tools (e.g. CRM list contacts via HubSpot adapter).
- Unbounded “all tools for all workers” is forbidden.

Code seeds: `packages/runtime-core` tool registry; `services/skills` as executable skill substrate.

---

## 7. Workflow engine

**Composition law (hard rule):**

| Component | Role |
|---|---|
| `services/workflow-engine` | Deterministic **execution kernel** (validate, guardrails, retry, timeline) |
| `services/workflows` | Platform **façade / registry / dispatch API** |
| Capabilities / packs | Domain workflow templates and contributions |
| Workers | Initiate and supervise workflows; do not embed a second engine |

Workflows must be **portable**: defined as data/templates with stable ids, not buried only inside a runtime prompt.

---

## 8. Memory

- Memory is scoped: `org` | `team` | `worker` | `thread` (see worker contracts).
- Service split: service → repository → persistence adapter.
- Current adapters: in-memory + JSON-file; durable stores plug in behind the same interfaces.
- Runtimes may project memory into sessions; core remains source of truth for durable memory policy.

---

## 9. Permissions, approvals, audit

- Every mutating Platform API is org-scoped and permission-checked.
- Workers operate under least privilege (capabilities + tools + approval policy).
- Human approval is required for consequential actions (configurable policy).
- Audit logging is first-class: who/what/when/why/outcome for worker tasks, integration calls, approvals, pack installs.
- Current code has policy/permission seeds; enforcement and durable audit sinks deepen over the roadmap without changing the principle.

---

## 10. Integrations

See Layer 5 and `IntegrationAdapter`:

- kinds: `mcp`, `rest`, `graphql`, `webhook`, `oauth`, `custom`, …
- MCP (`mcp/contracts` → `adapters` → `servers`) is an integration family, **not** the product brand.
- Secrets use references; never ship raw secrets to CX apps or prompts by default.

---

## 11. Frontend relationship

- Apps live conceptually under `apps/` (web, mobile, CEO dashboard, client portal).
- Hostinger Horizons (or any generator) is a **frontend accelerator**, never platform core.
- Frontends consume **versioned public Platform APIs** only.
- No direct database access and no direct runtime SDK usage from apps.

---

## 12. Repository map (current → target)

| Current | Role today | Target home |
|---|---|---|
| `packages/runtime-core` | Shared contracts + in-memory refs | stays; contracts expand here first |
| `services/*` | Control-plane services | `platform/*` gradually via re-exports |
| `mcp/*` | MCP integration stack | `integrations/mcp/*` alias/move |
| `runtimes/*` | Ownership + OpenClaw skeleton | concrete adapters |
| `capabilities/*` | Ownership + real-estate target | real module manifests/code |
| `packs/*` | Ownership + real-estate target | pack manifests |
| `src/skills/*` (app path) | Commercial MVP skill | migrate into capability/real-estate |
| `deploy/`, `infra/` | Rollout + IaC scaffolds | keep; deepen executors later |

Preserve working packages during moves. Prefer shims over breakage.

---

## 13. Deployment model

- Environments: dev → staging → prod with promotion gates.
- Production rollout policy is declarative (`deploy/production/*`).
- `scripts/release/deploy-prod.sh` validates and simulates stages (executor integration is roadmap work).
- Services are designed toward independently deployable units; local defaults may remain in-process.

---

## 14. Multi-tenancy

Architecture assumes:

- org as tenancy root
- pack/capability install state per org
- worker definitions per org
- memory and audit partitioned by org (and finer scopes)

In-memory implementations are acceptable early; APIs must not assume single-tenant globals.

---

## 15. What to preserve from the current codebase

- Interface-first service contracts and lifecycle/reliability patterns
- `runtime-core` primitives (events, permissions, tools, memory, model provider)
- MCP layering
- Deterministic workflow-engine kernel
- Memory repository/adapter split
- Commercial investment workflow MVP behavior
- New Runtime / Worker / Capability / Pack contracts and in-memory managers

---

## 16. Known misalignments (do not ignore)

| Issue | Why it matters |
|---|---|
| OpenClaw-named skill runner at product edge | Suggests runtime = product |
| Dual workflow surfaces without enforced composition | Drift risk |
| Commercial workflow still app-skill shaped | Blocks pack model |
| Package boundary / CI import resolution fragility | Blocks monorepo scale |
| In-memory defaults | Fine for now; must not freeze into public semantics |
| Incomplete public CX API | Blocks CEO dashboard / Horizons safely |

Details and sequencing: `docs/ROADMAP.md`.

---

## Related documents

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/RUNTIMES.md`
- `docs/AI_WORKERS.md`
- `docs/INDUSTRY_PACKS.md`
- `docs/ROADMAP.md`
- `docs/architecture/*` — historical/phase engineering notes (yield to this file on conflicts)
