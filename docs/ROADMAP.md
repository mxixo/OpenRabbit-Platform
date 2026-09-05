# OpenRabbit Roadmap

**Status:** Canonical incremental plan  
**Rule:** Preserve the working system. Migrate toward the architecture in `/docs` without big-bang rewrites.  
**Approval gate:** Major refactors wait for maintainer approval of this plan and the permanent docs set.

---

## 1. Current state (as of permanent docs formalization)

### What works today

- Modular TypeScript monorepo (`OpenRabbit-Platform`) with interface-first services
- `@openrabbit/runtime-core` contracts for:
  - RuntimeProvider + registry + mock runtime
  - Worker definitions, presets, registry, orchestrator
  - Capability modules + org manager
  - Integration adapter registry
  - Industry pack catalog + installer
- MCP contracts/adapters/server stack
- Workflow engine kernel + workflows service façade seeds
- Memory service with repository/persistence adapters
- Deploy/IaC scaffolds + production rollout dry-run script
- Commercial investment analysis MVP workflow (app skill path)
- Ownership dirs: `runtimes/`, `capabilities/`, `packs/`, `integrations/`

### What is misaligned (preserve behavior, fix shape)

| Gap | Impact |
|---|---|
| OpenClaw-named skill runner at product edge | Runtime/product confusion |
| Commercial workflow not yet a capability/pack | Industry model incomplete |
| `services/orchestrator` not wired to WorkerOrchestrator | Dual orchestration paths |
| Workflow façade ↔ kernel composition not enforced in code | Drift risk |
| Package boundary CI (`@openrabbit/*` resolution) fragile | #13 still open/failing historically |
| Public CEO/CX Platform API incomplete | Frontend/Horizons blocked from doing the right thing |
| Durable multi-tenant stores mostly in-memory | Scale/reliability limit |
| Permanent docs previously scattered | **Addressed by this docs suite** |

---

## 2. Immediate stabilization (now → next PRs)

**Goal:** Make `main` the trustworthy source of truth; stop new coupling.

1. **Land permanent docs** (`VISION`, `ARCHITECTURE`, `PRINCIPLES`, `RUNTIMES`, `AI_WORKERS`, `INDUSTRY_PACKS`, `ROADMAP`, `OPENRABBIT_CONTEXT`) — this PR.  
2. **Fix package boundary / CI resolution** so workspace `file:` / exports resolve under `npm ci` (revive intent of PR #13 correctly).  
3. **Document workflow composition ADR in code comments/docs** and prevent new execution logic in the façade.  
4. **Deprecation plan for `createOpenClawSkillRunner`** (shim signature + timeline).  
5. Keep commercial MVP green (`npm test` / workflow script).

**Exit criteria:** Docs merged; CI green for active packages; no new OpenClaw imports outside `runtimes/openclaw` + shims.

---

## 3. MVP — AI operating environment core loop

**Goal:** One CEO-usable loop on real-estate proving ground without claiming multi-industry polish.

Deliverables:

1. Concrete **`runtimes/openclaw` RuntimeProvider** (or interim generic runner adapter)  
2. Product APIs (even minimal) for:
   - org bootstrap  
   - worker list/create from presets  
   - run task / view result  
   - approval stub for consequential actions  
3. **`capabilities/real-estate`** hosts commercial investment workflow  
4. **`packs/real-estate`** installs capabilities + materializes Acquisitions/Research workers  
5. WorkerOrchestrator is the only supported task path for new features  

**Exit criteria:** Install RE pack → run underwriting workflow as Acquisitions worker → produce report → tests pass → OpenClaw only behind adapter/shim.

---

## 4. First paid real-estate product

**Goal:** Sellable RE operating environment for a narrow ICP (investor/operator CEO).

**Product direction:** `docs/REAL_ESTATE_FIRST_PRODUCT.md` is the accepted customer-experience and sequencing guide. The signed-in command center must lead with approvals, what changed, what matters, completed work, recommendations, and what happens next.

Deliverables:

- Auth + multi-tenant org hardening  
- CEO dashboard views (workers, approvals, deal pipeline metrics)  
- CRM integration (HubSpot or equivalent) via IntegrationAdapter  
- Replaceable webhook automation adapter (Zapier first) for inbound lead-to-deal intake, routed through the Lead-to-Deal Operations worker with approval-gated side effects
- Property data integration (Rentcast/MLS as available)  
- Billing-ready packaging of Real Estate Pack  
- Audit log for worker actions and approvals  
- Support runbooks and promotion gates used for real releases  

**Exit criteria:** Onboard paying org; pack install; workers active; underwriting + CRM path in production-like env; approval trail exists.

---

## 5. Multi-runtime support

**Goal:** Prove runtime-agnostic claim with a second runtime.

Deliverables:

- Second `RuntimeProvider` implementation  
- Runtime health/compatibility surfacing  
- Per-worker preference UX/API  
- Failover policy experiments  
- Compliance tests: Core has zero proprietary runtime imports  

**Exit criteria:** Two runtimes registered; workers can prefer either; OpenClaw removal test does not compile-break Core.

---

## 6. Broader industry expansion

**Goal:** Repeatable pack factory.

Deliverables:

- Pack authoring guide + manifest validation CI  
- Second industry pack (SMB or construction candidate)  
- Shared capabilities (email, calendar, knowledge, documents) matured  
- Optional pack marketplace mechanics later  

**Exit criteria:** Second pack installs without Core changes; no repo fork.

---

## 7. Cross-cutting scale foundations (parallel after MVP)

- Durable memory, events, workflow state resume  
- Observability (logs/metrics/traces schema)  
- Real deploy executors behind dry-run scripts  
- Stronger policy enforcement automation in CI/release  

---

## 8. Explicit non-goals (near term)

- Rewriting all `services/*` into new folders for aesthetics  
- Building every industry pack  
- Making Horizons part of backend core  
- Replacing TypeScript platform wholesale  
- Unbounded autonomous money movement without approvals  

---

## 9. Suggested sequencing diagram

```text
Stabilization (docs, CI, deprecations)
        ↓
MVP core loop (adapter + RE capability/pack + worker path)
        ↓
Paid RE product (tenancy, dashboard, CRM/data, audit, billing)
        ↓
Multi-runtime
        ↓
More packs + shared capabilities
```

---

## 10. Next three highest-priority implementation tasks

See also the PR summary accompanying this docs change. Maintainers should approve docs before large refactors.

1. **Implement `runtimes/openclaw` (or generic) RuntimeProvider and shim `createOpenClawSkillRunner`.**  
2. **Migrate commercial investment workflow into `capabilities/real-estate` + `packs/real-estate` manifests.**  
3. **Fix monorepo package boundary resolution/CI and wire `services/orchestrator` to `WorkerOrchestrator`.**  

---

## Related documents

- `OPENRABBIT_CONTEXT.md`
- `docs/VISION.md`
- `docs/ARCHITECTURE.md`
- `docs/architecture/*` (historical engineering notes; yield to this roadmap on product sequencing)
