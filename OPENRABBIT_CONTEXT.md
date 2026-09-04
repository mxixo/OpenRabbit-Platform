# OpenRabbit Context — Read Before You Change Architecture

**Mandatory for:** Warp, OpenClaw, Antigravity, ChatGPT, Cursor, human contributors, and any future AI tool.

This repository’s **GitHub documentation is the source of truth**. Do not invent a conflicting product model from chat history or prior agent runs.

---

## Non-negotiable vision (short)

OpenRabbit is an **AI Operating Environment**, not a chatbot and not a single AI agent.

- Customers buy **OpenRabbit** (the platform).  
- **OpenClaw** is one **runtime**, not the product.  
- Users may connect the **AI provider/runtime they prefer** through replaceable provider adapters; the OpenRabbit product and workflow model must not be hard-wired to one model vendor.  
- **AI Workers** are configurable specialized roles (EA, Ops, Marketing, Acquisitions, Finance, Research, Support, …).  
- **Industry Packs** extend core (Real Estate first) **without forking**.  
- The end user is the **owner/CEO**: describe goals and outcomes; OpenRabbit constructs and manages the underlying workflows, coordinates connected systems, surfaces what matters, and routes consequential actions through policy/approval gates.  
- The normal user experience must **not** resemble Zapier or an automation builder. Workflows are an internal orchestration primitive managed by the OpenRabbit brain unless an advanced user deliberately opens deeper controls.  
- Prefer **orchestration** of existing APIs/MCP/tools over rebuilding everything.  
- Connections should be durable and reusable after authorization; users should not repeatedly reconnect services just to keep ordinary work moving.  
- Stay **runtime-agnostic, modular, API-first, multi-tenant ready, permission-aware, auditable**.

---

## Required reading order before architectural proposals

1. `docs/VISION.md`  
2. `docs/PRINCIPLES.md`  
3. `docs/ARCHITECTURE.md`  
4. `docs/RUNTIMES.md`  
5. `docs/AI_WORKERS.md`  
6. `docs/INDUSTRY_PACKS.md`  
7. `docs/ROADMAP.md`  

Then inspect code under `packages/runtime-core`, `services/`, `runtimes/`, `capabilities/`, `packs/`.

---

## Separations you must not collapse

| Concept | Means |
|---|---|
| OpenRabbit | Product / platform / operating environment |
| Runtime | Execution engine adapter (OpenClaw = one) |
| AI provider | Replaceable model/account transport behind the OpenRabbit brain contract |
| AI Worker | Configurable specialized employee |
| Tool | Callable capability |
| Workflow | Portable ordered business process, normally generated/managed by OpenRabbit rather than manually built by the user |
| Integration | External system connection |
| Industry Pack | Vertical bundle extending core |

---

## Contribution rules

1. **No major refactors** until maintainers approve docs + migration plan in `docs/ROADMAP.md`.  
2. **No new OpenClaw imports** outside `runtimes/openclaw/**` and approved shims.  
3. **No fork-per-industry** repos or Core edits that only serve one vertical.  
4. **No frontend-owned business rules** (Horizons/apps are clients of Platform APIs).  
5. **Preserve working MVP behavior** (especially commercial investment workflow) while migrating shape.  
6. Update `/docs` when you change architecture—chat is not documentation.  
7. **Never silently fall back to a different AI provider** than the one the user selected; provider identity and execution must remain truthful and auditable.  
8. Prefer one conversational control surface plus context-aware approvals over exposing workflow builders, connector plumbing, or internal orchestration to normal users.

---

## If you are an AI assistant

Before proposing folder moves, new frameworks, or “rewrite as a single agent”:

- Re-read this file and the docs list above.  
- Prefer incremental PRs aligned to `docs/ROADMAP.md`.  
- Call out conflicts with `docs/PRINCIPLES.md` explicitly.  
- Ask for approval when work would be destructive or cross-cutting.

---

*Canonical context file for OpenRabbit Platform.*
