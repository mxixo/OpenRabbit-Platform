# OpenRabbit Runtimes

**Status:** Canonical runtime model  
**Code:** `packages/runtime-core/src/interfaces/runtime-provider.ts`, `runtimes/`

---

## 1. Definition

A **runtime** is an execution engine that can host AI worker sessions and run tasks.

OpenRabbit Core is **not** a runtime. OpenClaw is **not** the product.

```text
WorkerOrchestrator  →  RuntimeProvider (interface)  →  OpenClaw adapter
                                                ↳  Future runtime adapters
```

---

## 2. RuntimeProvider interface (canonical)

Implemented in `@openrabbit/runtime-core` as `RuntimeProvider`.

Minimum surface:

| Member | Purpose |
|---|---|
| `id`, `displayName` | Stable provider identity |
| `capabilities` | e.g. `tools`, `streaming`, `memory-projection`, `multi-session` |
| `startSession(input)` | Create session for org/worker with projected tools & capability allow-list |
| `stopSession(sessionId)` | Tear down session |
| `runTask(input)` | Execute a task in a session; return normalized result |
| `listProjectedTools?(sessionId)` | Optional introspection |
| `getSession?(sessionId)` | Optional session lookup |

Supporting types: `RuntimeSession`, `RuntimeTaskRequest`, `RuntimeTaskResult`, `RuntimeTaskEvent`, `ToolRef`.

Registry: `RuntimeProviderRegistry` with ordered `resolvePreference(preferredIds)`.

Reference test double: `MockRuntimeProvider` (not a production adapter).

---

## 3. OpenClaw’s current role

| OpenClaw is | OpenClaw is not |
|---|---|
| Runtime adapter #1 | The OpenRabbit product |
| Allowed under `runtimes/openclaw/**` | Importable from Core services or CX apps |
| Responsible for session/task execution details | Owner of org/worker/pack models |

### Migration rule

Existing product-edge helpers such as `createOpenClawSkillRunner` must become **deprecated shims** over:

1. generic skill/worker dispatch, and/or  
2. a real `RuntimeProvider` implementation in `runtimes/openclaw`

No new OpenClaw-named public Platform APIs.

---

## 4. Capability discovery

Runtimes advertise capabilities via `RuntimeProvider.capabilities`.

Platform uses this to:

- validate worker preferences
- decide whether streaming/tool projection/memory projection is available
- surface health/compatibility in operator views

Tool discovery for a session uses projected `ToolRef`s from Core (allow-listed), not unbounded runtime freestyle access.

---

## 5. Health checks

Each adapter should support operational health, normalized for platform use:

| Signal | Meaning |
|---|---|
| Process/connectivity | Adapter can reach its engine |
| Auth | Credentials/config valid |
| Degraded mode | Partial capability (e.g. tools down, text-only up) |

Until a dedicated `health()` method exists on all adapters, deployment health can wrap adapter probes. Prefer adding explicit health to the contract when the first non-mock adapter lands.

Integration adapters (`IntegrationAdapter.health`) remain separate: they check external systems, not the AI runtime engine.

---

## 6. Permissions

Runtimes **enforce projection**, they do not define org policy.

- Core decides allowed tools/capabilities per worker.
- Session start carries `projectedTools` and `allowedCapabilities`.
- Runtime must not silently expand tool access beyond projection.
- Secrets are injected via controlled integration/secret refs—not worker free text.

---

## 7. Task execution semantics

Normalized task statuses: `completed` | `failed` | `blocked` | `cancelled`.

| Status | Use |
|---|---|
| completed | Success with optional output |
| failed | Error with `code`, `message`, `retryable?` |
| blocked | Waiting on approval/external input |
| cancelled | Explicit cancel |

Adapters map proprietary errors into these codes. Orchestrators may retry only when `retryable` is true and policy allows.

---

## 8. Failure handling

1. **Session missing/stopped** → fail task with stable code (`session_not_found` / `session_not_runnable`).  
2. **Provider missing from preference list** → registry throws; orchestrator returns rejected/failed.  
3. **Handler exception** → capture as failed + retryable when transient.  
4. **Partial outage** → mark provider unhealthy; fail over to next `runtimePreference` when policy allows.  
5. **Never** swallow side effects without events/audit from Core’s perspective.

---

## 9. Coexistence and replacement

- Multiple providers may be registered simultaneously.
- Workers declare `runtimePreference: string[]` (ordered).
- Replacing OpenClaw: implement new adapter → register → update worker presets/packs → deprecate old provider.
- Removing OpenClaw must not require Core API changes.

---

## 10. Repository layout

```text
runtimes/
  README.md
  contracts/     # ownership notes; TS contracts live in runtime-core today
  openclaw/      # only OpenClaw SDK/env imports allowed here
  <future>/
```

### Import rule

Only `runtimes/<name>/**` (and explicitly approved shims) may import that runtime’s proprietary SDK.

---

## 11. Implementation status

| Item | Status |
|---|---|
| `RuntimeProvider` contracts | Done (`runtime-core`) |
| In-memory registry + mock provider | Done |
| WorkerOrchestrator preference routing | Done |
| `runtimes/openclaw` concrete adapter | Skeleton docs only |
| Product-edge OpenClaw rename/shim | Pending |
| Multi-runtime production ops | Future |

---

## Related documents

- `docs/ARCHITECTURE.md`
- `docs/AI_WORKERS.md`
- `docs/PRINCIPLES.md`
- `docs/ROADMAP.md`
