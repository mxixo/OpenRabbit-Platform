# OpenRabbit Principles

**Status:** Permanent product and engineering rules  
**Applies to:** All human and AI contributors  
**Authority:** If a proposal violates these principles, change the proposal—not the principles—unless the maintainers explicitly revise this file.

---

## 1. Product principles

### 1.1 OpenRabbit is an operating environment
Build for workers, workflows, permissions, metrics, and approvals—not for endless chat threads as the product core.

### 1.2 The user is the CEO
The platform organizes mission → departments/workers → goals → workflows → reports → **approved** actions. The human remains accountable.

### 1.3 Runtime-agnostic by default
OpenClaw is welcome as runtime #1. It must never become synonymous with OpenRabbit in APIs, package names at the product edge, or docs.

### 1.4 Industry packs extend; they do not fork
Real estate is the first proving ground. Core stays reusable. Verticals ship as packs.

### 1.5 Orchestration over reimplementation
1. Connect an existing service when it is good enough.  
2. If missing, build a reusable capability module.  
3. Rebuild only when ownership, latency, compliance, or cost justify it.

### 1.6 Human approval for consequential actions
Anything that spends money, sends irreversible external communications, changes production systems of record, or alters security posture requires policy gates and, by default, human approval.

### 1.7 Auditability is a feature
Important actions leave a durable, queryable trail.

### 1.8 GitHub is the source of truth
Repository docs and code review—not chat memory—govern architecture. AI tools must read `OPENRABBIT_CONTEXT.md` and `/docs` before proposing structural changes.

---

## 2. Engineering principles

### 2.1 Separation of concerns (non-negotiable)
Keep distinct:

- OpenRabbit (platform)
- Runtime
- AI Worker
- Tool
- Workflow
- Integration
- Industry Pack
- Frontend

Do not collapse these into one class, package, or prompt.

### 2.2 Interface-first
Define contracts before adapters. Prefer small stable interfaces with deterministic errors.

### 2.3 API-first and frontend-independent
Platform capabilities are exposed via versioned APIs. UIs (including Hostinger Horizons) are clients. No business rules that exist only in frontend code.

### 2.4 Modular and composable
Capabilities and packs are installable units. Workers compose tools and capabilities; packs compose workers and capabilities.

### 2.5 Extensible without core edits
Adding a runtime, worker preset, capability, or integration should not require editing unrelated core services.

### 2.6 Multi-tenant ready
Even early in-memory code must use org-scoped identifiers and avoid global singleton assumptions in public APIs.

### 2.7 Permission-aware by default
Least privilege for workers and integrations. Deny by default when unsure.

### 2.8 Portable workflows
Workflows are data + deterministic kernel semantics, not trapped inside one runtime’s proprietary memory.

### 2.9 Replaceable integrations
Vendors hide behind `IntegrationAdapter` (or equivalent). Swapping HubSpot for another CRM should not rewrite workers.

### 2.10 Avoid vendor lock-in
No hard dependency from Core on a single model vendor, runtime vendor, cloud UI builder, or CRM.

### 2.11 Incremental migration
Preserve working behavior. Use shims and adapters. Every phase leaves `main` shippable.

### 2.12 Test the contracts
New abstractions ship with unit tests around registries, allow-lists, install lifecycle, and failure modes.

### 2.13 Package boundaries
Import public entrypoints (`@openrabbit/*`), not deep relative `src/` internals across packages.

### 2.14 Security hygiene
Secrets are referenced, not embedded in manifests, logs, prompts, or client bundles.

---

## 3. Naming rules

| Do | Don't |
|---|---|
| Worker, runtime, capability, pack | “The bot”, “the OpenClaw”, “the agent does everything” |
| `runtimes/openclaw` for claw code | Import OpenClaw SDK from `services/*` or apps |
| `capabilities/real-estate` | Copy repo for “OpenRabbit RE” |
| Platform API | Horizons-only endpoints as core |

---

## 4. Decision test (use before large changes)

Ask:

1. Does this keep Platform ≠ Runtime ≠ Worker?  
2. Could we add another runtime without rewriting this?  
3. Could another industry reuse this without a fork?  
4. Is the CEO still in the approval loop for consequential actions?  
5. Is this orchestrating an existing system when we should?  
6. Are docs in `/docs` updated if architecture shifts?  

If any answer is no, redesign.

---

## 5. Anti-patterns (explicitly rejected)

1. Mega-agent prompt that “runs the company”  
2. OpenClaw-as-core  
3. Fork-per-industry repositories  
4. Frontend-as-source-of-truth  
5. Parallel workflow engines with divergent semantics  
6. Unversioned skill dumps without manifests  
7. Silent side effects without audit  
8. Big-bang rewrites of green services for folder aesthetics  

---

## Related documents

- `OPENRABBIT_CONTEXT.md`
- `docs/VISION.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
