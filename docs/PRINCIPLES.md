# OpenRabbit Principles

**Status:** Permanent product and engineering rules  
**Applies to:** All human and AI contributors  
**Authority:** If a proposal violates these principles, change the proposal—not the principles—unless the maintainers explicitly revise this file.

---

## 1. Product principles

### 1.1 OpenRabbit is an adaptive operating environment
Build for workers, workflows, permissions, metrics, approvals, and an environment that adapts around the user—not for endless chat threads as the product core. OpenRabbit should mold itself around the user's goals, context, tools, and changing needs rather than requiring the user to mold themselves around software.

### 1.2 The user is the CEO
The platform organizes mission → departments/workers → goals → workflows → reports → **approved** actions. The human remains accountable.

### 1.3 User → Goals → Environment → Capabilities → Tools
This is the product hierarchy. Do not begin with the platform's feature inventory and force the user to configure it. Learn enough about the user to compose a sensible environment, then progressively disclose capabilities as they become relevant.

### 1.4 Adaptation is continuous, not onboarding-only
Onboarding creates the first useful environment. OpenRabbit should be able to evolve it as the user's goals, responsibilities, team, business, workflows, and connected tools change. Adaptation must remain explainable, permission-aware, reversible where practical, and auditable.

### 1.5 Runtime-agnostic by default
OpenClaw is welcome as runtime #1. It must never become synonymous with OpenRabbit in APIs, package names at the product edge, or docs.

### 1.6 Industry packs extend; they do not fork
Real estate is the first proving ground. Core stays reusable. Verticals ship as packs. Industry Packs should provide enough vocabulary, workflows, policies, adapters, worker presets, and onboarding knowledge for OpenRabbit to construct a useful vertical-specific environment.

### 1.7 Orchestration over reimplementation
1. Connect an existing service when it is good enough.  
2. If missing, build a reusable capability module.  
3. Rebuild only when ownership, latency, compliance, user experience, or cost justify it.

Support **connect, migrate, and hybrid** patterns. Hybrid is generally preferred when existing systems of record already work well.

### 1.8 Delegated authorization over password custody
Prefer OAuth, scoped API credentials, MCP/connectors, and other delegated authorization mechanisms. Do not design OpenRabbit around collecting or storing third-party account passwords when a safer delegated mechanism exists. Credentials and tokens must follow least privilege.

### 1.9 Human approval for consequential actions
Anything that spends money, sends irreversible external communications, changes production systems of record, or alters security posture requires policy gates and, by default, human approval.

### 1.10 Model the user; do not impersonate the user
OpenRabbit may maintain an increasingly useful operational model of goals, preferences, relationships, responsibilities, tools, permissions, routines, and working patterns. That model exists to improve the environment. It does not erase the boundary between human and system or authorize silent impersonation.

### 1.11 Progressive disclosure over feature overload
A broad capability surface is acceptable; presenting every capability to every user is not. Keep the experience **complex underneath, simple on the surface, adaptive by default**. Advanced configuration should remain available without becoming a prerequisite for value.

### 1.12 Auditability is a feature
Important actions leave a durable, queryable trail. Important adaptive changes should also be explainable: what changed, why, and under what authority.

### 1.13 GitHub is the source of truth
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
Capabilities and packs are installable units. Workers compose tools and capabilities; packs compose workers and capabilities. The adaptive composition layer must be able to activate, recommend, hide, or configure these units without hardcoding one user's environment into Core.

### 2.5 Extensible without core edits
Adding a runtime, worker preset, capability, integration, onboarding profile, or Industry Pack should not require editing unrelated core services.

### 2.6 Multi-tenant ready
Even early in-memory code must use org-scoped identifiers and avoid global singleton assumptions in public APIs.

### 2.7 Permission-aware by default
Least privilege for workers and integrations. Deny by default when unsure. Adaptation may never silently broaden permissions.

### 2.8 Portable workflows
Workflows are data + deterministic kernel semantics, not trapped inside one runtime's proprietary memory.

### 2.9 Replaceable integrations
Vendors hide behind `IntegrationAdapter` (or equivalent). Swapping HubSpot for another CRM should not rewrite workers or the user's higher-level operating model.

### 2.10 Avoid vendor lock-in
No hard dependency from Core on a single model vendor, runtime vendor, cloud UI builder, or CRM.

### 2.11 Incremental migration
Preserve working behavior. Use shims and adapters. Every phase leaves `main` shippable.

### 2.12 Test the contracts
New abstractions ship with unit tests around registries, allow-lists, install lifecycle, permission boundaries, adaptation decisions, and failure modes.

### 2.13 Package boundaries
Import public entrypoints (`@openrabbit/*`), not deep relative `src/` internals across packages.

### 2.14 Security hygiene
Secrets are referenced, not embedded in manifests, logs, prompts, or client bundles. Third-party passwords are not an integration strategy when delegated authorization is available.

---

## 3. Naming rules

| Do | Don't |
|---|---|
| Adaptive operating environment | Static feature dashboard as product identity |
| Worker, runtime, capability, pack | “The bot”, “the OpenClaw”, “the agent does everything” |
| `runtimes/openclaw` for claw code | Import OpenClaw SDK from `services/*` or apps |
| `capabilities/real-estate` | Copy repo for “OpenRabbit RE” |
| Platform API | Horizons-only endpoints as core |
| Operational user/org model | “Become” or silently impersonate the user |
| OAuth/delegated authorization | Ask users for third-party passwords by default |

---

## 4. Decision test (use before large changes)

Ask:

1. Does this keep Platform ≠ Runtime ≠ Worker?  
2. Could we add another runtime without rewriting this?  
3. Could another industry reuse this without a fork?  
4. Is the CEO still in the approval loop for consequential actions?  
5. Is this orchestrating an existing system when we should?  
6. Does this help the environment adapt to the user rather than forcing the user to configure the platform?  
7. Are we progressively disclosing complexity instead of overwhelming the user?  
8. Does adaptation preserve permissions, explainability, and auditability?  
9. Are docs in `/docs` updated if architecture shifts?  

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
9. Feature-catalog onboarding that asks users to architect their own environment before receiving value  
10. Silent permission expansion in the name of personalization  
11. Collecting third-party passwords when delegated authorization is available  
12. Treating adaptation as cosmetic UI personalization rather than composition of the operating environment  

---

## Related documents

- `OPENRABBIT_CONTEXT.md`
- `docs/VISION.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
