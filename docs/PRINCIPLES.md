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

### 1.5 Adapt above; evolve below
OpenRabbit has two complementary adaptation responsibilities:

- **Above the platform:** adapt the environment to the user and organization.
- **Below the experience:** evolve implementation technology as superior models, runtimes, providers, protocols, infrastructure, databases, frameworks, and methods become available.

The user should receive the benefits of technological progress without needing their environment rebuilt from scratch.

### 1.6 No component earns permanence; interfaces do
Models, runtimes, vendors, databases, infrastructure providers, mapping providers, automation engines, and other implementation components are replaceable. Stable contracts, permissions, workflows, data boundaries, audit history, and user experience are the durable assets.

New technology should be adoptable incrementally behind stable interfaces. Multiple technologies may coexist when different workloads benefit from different implementations.

### 1.7 Runtime-agnostic and model-agnostic by default
OpenClaw is welcome as runtime #1. It must never become synonymous with OpenRabbit in APIs, package names at the product edge, or docs. Likewise, no individual model provider should become inseparable from the platform.

### 1.8 Industry packs extend; they do not fork
Real estate is the first proving ground. Core stays reusable. Verticals ship as packs. Industry Packs should provide enough vocabulary, workflows, policies, adapters, worker presets, and onboarding knowledge for OpenRabbit to construct a useful vertical-specific environment.

### 1.9 Orchestration over reimplementation
1. Connect an existing service when it is good enough.  
2. If missing, build a reusable capability module.  
3. Rebuild only when ownership, latency, compliance, user experience, or cost justify it.

Support **connect, migrate, and hybrid** patterns. Hybrid is generally preferred when existing systems of record already work well.

### 1.10 Delegated authorization over password custody
Prefer OAuth, scoped API credentials, MCP/connectors, and other delegated authorization mechanisms. Do not design OpenRabbit around collecting or storing third-party account passwords when a safer delegated mechanism exists. Credentials and tokens must follow least privilege.

### 1.11 Human approval for consequential actions
Anything that spends money, sends irreversible external communications, changes production systems of record, or alters security posture requires policy gates and, by default, human approval.

### 1.12 Model the user; do not impersonate the user
OpenRabbit may maintain an increasingly useful operational model of goals, preferences, relationships, responsibilities, tools, permissions, routines, and working patterns. That model exists to improve the environment. It does not erase the boundary between human and system or authorize silent impersonation.

### 1.13 Progressive disclosure over feature overload
A broad capability surface is acceptable; presenting every capability to every user is not. Keep the experience **complex underneath, simple on the surface, adaptive by default**. Advanced configuration should remain available without becoming a prerequisite for value.

### 1.14 Evolution must be evidence-driven
OpenRabbit should move quickly without chasing novelty. Candidate replacements or additions should be evaluated against measurable improvement in capability/quality, speed/latency, reliability, cost/efficiency, security/privacy, maintainability, interoperability/portability, user experience, and migration risk.

Where practical, benchmark representative OpenRabbit workloads before broad adoption. A new technology does not replace an existing component merely because it is newer.

### 1.15 Anti-obsolescence is an architectural requirement
OpenRabbit must retain the ability to modernize itself without becoming the rigid legacy system it was created to overcome. Architecture that unnecessarily makes a replaceable technology permanent creates strategic debt and should be challenged.

### 1.16 Evolve without trapping the user
OpenRabbit updates should be **tested, versioned, observable, staged, and reversible when practical**. Platform evolution must not silently redefine a user's operating environment.

For non-critical changes, preserve meaningful user choice: supported known-good versions, staged rollout, explicit update channels, and rollback where technically safe and compatible. Release notes should explain material changes, benefits, compatibility impact, and migration considerations.

Security, legal/compliance, provider deprecation, or hard compatibility requirements may make some updates mandatory or make indefinite rollback impossible. In those cases, explain the requirement, preserve user configuration and behavior where possible, provide migration tooling, and minimize disruption.

### 1.17 Separate platform evolution from user configuration
Treat these as distinct versioned concerns:

1. **Platform version** — OpenRabbit core/control-plane behavior.
2. **Component versions** — models, runtimes, plugins, adapters, providers, capability modules, and infrastructure implementations.
3. **Industry Pack/workflow versions** — reusable domain behavior and process definitions.
4. **User environment configuration** — selected capabilities, permissions, layouts, preferences, workflows, and operating context.

Upgrading a component should not unnecessarily alter the user's CRM workflows, permissions, dashboard layout, business rules, or stored context.

### 1.18 Continuity is a product requirement
OpenRabbit should move quickly while protecting continuity. The user's business must not become collateral damage of platform evolution. Rollback mechanisms must protect data integrity and security and should restore compatible known-good implementations/configuration rather than blindly reverse irreversible external actions or unsafe data migrations.

### 1.19 Auditability is a feature
Important actions leave a durable, queryable trail. Important adaptive changes and platform updates should also be explainable: what changed, why, under what authority, and which version produced the action.

### 1.20 GitHub is the source of truth
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
Define contracts before adapters. Prefer small stable interfaces with deterministic errors. Treat interfaces as the primary mechanism that allows implementation technology to evolve without destabilizing OpenRabbit.

### 2.3 API-first and frontend-independent
Platform capabilities are exposed via versioned APIs. UIs (including Hostinger Horizons) are clients. No business rules that exist only in frontend code.

### 2.4 Modular and composable
Capabilities and packs are installable units. Workers compose tools and capabilities; packs compose workers and capabilities. The adaptive composition layer must be able to activate, recommend, hide, or configure these units without hardcoding one user's environment into Core.

### 2.5 Extensible without core edits
Adding or replacing a runtime, model provider, worker preset, capability, integration, onboarding profile, infrastructure adapter, or Industry Pack should not require editing unrelated core services.

### 2.6 Multi-tenant ready
Even early in-memory code must use org-scoped identifiers and avoid global singleton assumptions in public APIs.

### 2.7 Permission-aware by default
Least privilege for workers and integrations. Deny by default when unsure. Adaptation may never silently broaden permissions.

### 2.8 Portable workflows
Workflows are data + deterministic kernel semantics, not trapped inside one runtime's proprietary memory.

### 2.9 Replaceable integrations
Vendors hide behind `IntegrationAdapter` (or equivalent). Swapping HubSpot for another CRM should not rewrite workers or the user's higher-level operating model. Apply the same principle to other external providers where practical.

### 2.10 Avoid vendor and implementation lock-in
No hard dependency from Core on a single model vendor, runtime vendor, cloud UI builder, CRM, mapping provider, infrastructure provider, or automation framework when a stable abstraction is reasonably achievable.

### 2.11 Incremental migration
Preserve working behavior. Use shims and adapters. Every phase leaves `main` shippable. Prefer component replacement and migration over rewrites of the entire environment.

### 2.12 Benchmark before strategic replacement
For material technology substitutions, maintain representative workloads and compare relevant quality, performance, reliability, security, and cost characteristics. Route different workload classes to different implementations when that produces a superior system.

### 2.13 Version components independently
Where practical, version platform APIs, runtimes, adapters, capability modules, Industry Packs, workflows, and configuration schemas independently. Record compatibility constraints explicitly rather than relying on implicit coupling.

### 2.14 Design migrations with rollback boundaries
Every material migration should identify its rollback boundary before rollout: what can be reverted, what data transformations are forward-only, what external actions are irreversible, and how a known-good state will be restored. Never advertise rollback where data integrity cannot be guaranteed.

### 2.15 Use staged release channels
Support controlled rollout patterns such as **Stable**, **Preview**, and an advanced/experimental channel where appropriate. Production organizations should not become involuntary beta testers for non-critical platform changes.

### 2.16 Test the contracts
New abstractions ship with unit tests around registries, allow-lists, install lifecycle, permission boundaries, adaptation decisions, provider replacement, version compatibility, migration/rollback behavior, and failure modes.

### 2.17 Package boundaries
Import public entrypoints (`@openrabbit/*`), not deep relative `src/` internals across packages.

### 2.18 Security hygiene
Secrets are referenced, not embedded in manifests, logs, prompts, or client bundles. Third-party passwords are not an integration strategy when delegated authorization is available.

---

## 3. Naming rules

| Do | Don't |
|---|---|
| Adaptive, evolving operating environment | Static feature dashboard as product identity |
| Stable interface / replaceable implementation | Treat today's vendor as permanent architecture |
| Versioned, staged, reversible update | Silent forced behavioral change |
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
2. Could we add or replace another runtime/model/provider without rewriting the environment?  
3. Could another industry reuse this without a fork?  
4. Is the CEO still in the approval loop for consequential actions?  
5. Is this orchestrating an existing system when we should?  
6. Does this help the environment adapt to the user rather than forcing the user to configure the platform?  
7. Are we progressively disclosing complexity instead of overwhelming the user?  
8. Does adaptation preserve permissions, explainability, and auditability?  
9. Are we making an implementation component unnecessarily permanent?  
10. If replacing technology, is the change supported by measurable benefit and an acceptable migration path?  
11. Is the change versioned, compatibility-aware, and staged appropriately?  
12. Have we identified a safe rollback boundary or explicitly documented why rollback is impossible?  
13. Does this preserve the user's environment configuration unless changing it is necessary and explained?  
14. Are docs in `/docs` updated if architecture shifts?  

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
13. Treating a current model, runtime, vendor, protocol, framework, or infrastructure provider as permanent without architectural necessity  
14. Rewriting OpenRabbit merely to adopt a fashionable technology when a bounded adapter or incremental migration would suffice  
15. Refusing a demonstrably superior technology because replacing the existing implementation is inconvenient  
16. Silent forced upgrades that materially change non-critical user behavior without notice or migration support  
17. Claiming an update is reversible when its data migration or external side effects cannot safely be undone  
18. Coupling user configuration so tightly to a component version that routine platform upgrades require rebuilding the user's environment  

---

## 6. Three dimensions of adaptability

OpenRabbit's adaptability should be evaluated across three dimensions:

1. **User adaptability** — mold the environment around how the person works.
2. **Organizational adaptability** — evolve as the user's team, goals, business, workflows, and industry change.
3. **Technological adaptability** — replace or add better models, runtimes, tools, infrastructure, protocols, and methods without rebuilding OpenRabbit.

Working doctrine:

> **OpenRabbit is an adaptive, evolving operating environment—built to change with its user, their organization, and the technology around it.**

Internal engineering philosophy:

> **The rabbit doesn't slow down.**

This means rapid learning, benchmarking, modular improvement, deliberate adoption of superior technology, and continuity for the user—not uncontrolled architectural churn.

---

## Related documents

- `OPENRABBIT_CONTEXT.md`
- `docs/VISION.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
