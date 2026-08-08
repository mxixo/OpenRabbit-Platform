# OpenRabbit AI Workers

**Status:** Canonical worker model  
**Code:** `packages/runtime-core/src/interfaces/worker.ts`, worker registries/orchestrator

---

## 1. Definition

An **AI Worker** is a configurable specialized employee inside OpenRabbit.

Workers are **product objects**, not runtimes and not generic chat sessions.

Examples:

- Executive Assistant  
- Operations Manager  
- Marketing Manager  
- Acquisitions Analyst  
- Finance Analyst  
- Research Analyst  
- Customer Support Agent  
- Custom roles defined by packs or orgs  

`AgentRegistry` remains a lower-level substrate. **`WorkerDefinition` is the org-facing model.**

---

## 2. Worker configuration

Canonical fields (`WorkerDefinition`):

| Field | Purpose |
|---|---|
| `id` | Stable worker id |
| `orgId` | Tenant scope |
| `role` | Builtin or custom role key |
| `displayName` | Human label |
| `mission` | Charter / job description |
| `runtimePreference` | Ordered runtime provider ids |
| `allowedCapabilities` | Capability module ids |
| `allowedTools` | Tool names projectable into sessions |
| `memoryScope` | `org` \| `team` \| `worker` \| `thread` |
| `approvalPolicy` | Policy ref + requiresApproval / retries |
| `status` | `active` \| `inactive` \| `suspended` |
| `tags` / `metadata` | Classification and extension data |

**Presets** (`WorkerPreset`) are templates used by industry packs and onboarding.  
`materializeWorkerPreset(preset, { id, orgId, ... })` creates an org-scoped worker.

---

## 3. Roles and reporting structure

Conceptual org chart (illustrative):

```text
CEO (human)
 ├── Executive Assistant (worker)
 ├── Operations Manager (worker)
 │    └── Customer Support (worker)
 ├── Marketing Manager (worker)
 ├── Finance Analyst (worker)
 └── Acquisitions / Research (workers)   ← real-estate pack heavy
```

Rules:

- Reporting lines and department labels may live in metadata/pack defaults.
- Authority to act is always **permissions + tools + approval policy**, not prompt bravado.
- Workers may delegate tasks only within policy (future: explicit delegation graph).

---

## 4. Scopes and memory boundaries

| Scope | Typical use |
|---|---|
| `org` | Shared company knowledge, playbooks |
| `team` | Departmental context |
| `worker` | Role-specific memory |
| `thread` | Single task/conversation episode |

Workers must not read memory outside their scope and org. Cross-scope access requires Core-mediated elevation and audit.

---

## 5. Tool permissions

- Tools are explicit allow-lists on the worker.
- On session start, `WorkerOrchestrator` projects only allowed tools.
- Even if a tool resolver returns extras, the orchestrator filters to the allow-list.
- Capability enablement at org level does not automatically grant every tool to every worker—workers still need allow-list entries (packs usually set these in presets).

---

## 6. Human approval semantics

`WorkerTaskRequest.actionKind` makes the side-effect boundary explicit:

- `read` (default): analysis/research/compute-only task; may execute without approval.
- `write`: consequential or side-effecting task; if the worker policy has `requiresApproval: true`, the orchestrator blocks execution unless `approval.granted === true`.

Blocked write tasks return `status: "blocked"` with `error.code: "approval_required"` **before a RuntimeProvider is invoked**.

Approved write tasks may include:

- `approvalId`
- `approvedBy`
- `approvedAt`

The orchestrator forwards these fields into runtime task metadata for downstream audit/event persistence. Durable approval records and dedicated approve/deny APIs remain a follow-up concern.

This means an Acquisitions Analyst can freely underwrite a deal, while actions such as sending outreach, writing CRM records, publishing content, or executing another side effect can be approval-gated.

---

## 7. Goals, metrics, and reporting

Workers should eventually track:

- assigned goals / OKRs (org or pack defined)
- task outcomes and quality signals
- escalation counts and approval wait times
- domain KPIs (e.g. deals screened, tickets resolved)

MVP path: task results + events. CEO dashboard APIs aggregate later (`docs/ROADMAP.md`).

---

## 8. Lifecycle

```text
preset (pack) → materialize → register → active
     → run tasks via WorkerOrchestrator
     → suspend / inactive
     → unregister (pack uninstall may remove pack-created workers)
```

`WorkerOrchestrator` responsibilities:

1. Resolve worker  
2. Ensure active status  
3. Enforce approval boundary for consequential tasks  
4. Choose runtime via preference  
5. Project tools/capabilities into session  
6. `runTask` and normalize result  
7. Stop session on demand  

---

## 9. Delegation

Near term:

- Workers invoke workflows and tools; humans approve consequential steps.

Later:

- Explicit delegate-to-worker APIs with scope narrowing
- No ambient authority inheritance beyond policy

---

## 10. Builtin role keys

```text
executive_assistant
marketing_manager
acquisitions_analyst
finance_analyst
operations_manager
research_analyst
customer_support
custom
```

Packs may introduce additional role strings; Core treats unknown roles as valid custom roles.

---

## 11. Implementation status

| Item | Status |
|---|---|
| Worker contracts + presets | Done |
| In-memory registry + validation | Done |
| WorkerOrchestrator + tests | Done |
| Service wiring (`services/orchestrator`) | Done |
| Real Estate bootstrap / worker execution loop | Done |
| Initial Platform API worker/task routes | Done |
| Read-vs-write approval enforcement | Done (in-memory orchestration path) |
| Durable approval records + approve/deny API | Pending |
| Durable worker store | Pending |
| Broader CEO dashboard APIs | Pending |

---

## Related documents

- `docs/RUNTIMES.md`
- `docs/INDUSTRY_PACKS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
