# Proposed Folder Structure (Incremental)

## Goal

Reflect the five-layer architecture in the repository **without** requiring an immediate mass move that breaks existing packages, CI, or the commercial workflow MVP.

Strategy:

1. Introduce target top-level homes and contracts.
2. Keep current `services/*`, `mcp/*`, and `packages/runtime-core` working.
3. Re-export or thin-wrap until call sites move.
4. Delete shims only after dependents are migrated.

## Target top-level layout

```text
OpenRabbit-Platform/
  apps/                         # Layer 1 — Customer Experience
    web/
    mobile/
    ceo-dashboard/
    client-portal/

  platform/                     # Layer 2 — OpenRabbit Core (product control plane)
    identity/                   # users, orgs, memberships (future)
    permissions/                # policy façade (from services/policy)
    api-gateway/                # public API (from services/api-gateway)
    workers/                    # worker definitions + orchestrator
    workflows/                  # workflows façade service
    workflow-engine/            # deterministic kernel
    memory/                     # memory manager
    tools/                      # tool/plugin registry façades
    model-gateway/              # model access
    events/                     # event system conventions/adapters
    clients/                    # channel/session adapters for apps

  runtimes/                     # Layer 3 — Runtime providers
    contracts/                  # RuntimeProvider interfaces
    openclaw/                   # OpenClaw adapter only
    # <future-runtime>/

  capabilities/                 # Layer 4 — installable modules
    crm/
    calendar/
    email/
    knowledge/
    documents/
    finance/
    marketing/
    sales/
    real-estate/
    construction/
    healthcare/
    legal/

  integrations/                 # Layer 5 — connectors
    mcp/                        # move/alias current mcp/*
    rest/
    graphql/
    webhooks/
    oauth/

  packs/                        # Industry packs (compose capabilities + workers)
    real-estate/
    construction/
    healthcare/
    legal/
    ecommerce/
    smb/

  packages/
    runtime-core/               # shared contracts/utilities (existing)
    # optional later splits: platform-contracts, worker-contracts, etc.

  deploy/
  infra/
  scripts/
  docs/
  tests/
  evals/
  specs/
  prompts/                      # shared prompt assets if needed (not product core)
```

## Mapping from current tree

| Current path | Target home | Migration style |
|---|---|---|
| `packages/runtime-core` | `packages/runtime-core` (+ new contracts) | extend in place |
| `services/api-gateway` | `platform/api-gateway` | later move or package rename via re-export |
| `services/policy` | `platform/permissions` | re-export then move |
| `services/orchestrator` | `platform/workers` (orchestrator) | re-scope + rename gradually |
| `services/workflows` | `platform/workflows` | façade clarification first |
| `services/workflow-engine` | `platform/workflow-engine` | move after façade contract docs land |
| `services/memory` | `platform/memory` | keep behavior, move later |
| `services/skills` | `platform/tools` or `platform/skills` | skills are tool substrate, not workers |
| `services/model-gateway` | `platform/model-gateway` | keep |
| `services/clients` | `platform/clients` | keep as app channel adapters |
| `mcp/*` | `integrations/mcp/*` | alias first |
| `domains/real-estate` | `capabilities/real-estate` + `packs/real-estate` | promote from docs/MVP |
| `integrations/` (placeholder) | `integrations/*` | fill with adapters |
| `clients/desktop|mobile` | `apps/*` | CX only |
| OpenRabbit app `src/skills/*` | `capabilities/*` + `runtimes/openclaw` | migrate commercial skill; demote claw runner |
| OpenRabbit app `createOpenClawSkillRunner` | `runtimes/openclaw` + deprecated shim | rename at product edge |

## Near-term physical layout (phase 0–2)

Do **not** move everything on day one. Recommended immediate physical additions:

```text
docs/architecture/
  ai-operating-environment-vision.md
  ai-operating-environment-gap-analysis.md
  ai-operating-environment-target-architecture.md
  ai-operating-environment-folder-structure.md
  ai-operating-environment-roadmap.md

packages/runtime-core/src/interfaces/
  runtime-provider.ts          # new
  worker.ts                    # new
  capability-module.ts         # new
  industry-pack.ts             # new
  integration-adapter.ts       # new

runtimes/
  README.md                    # ownership rules
  contracts/README.md
  openclaw/README.md           # adapter boundary + non-goals

capabilities/
  README.md
  real-estate/README.md        # migration target for commercial workflow

packs/
  README.md
  real-estate/README.md

apps/
  README.md                    # CX independence rules
```

Existing `services/*` remain authoritative implementations until explicit move PRs.

## Package naming guidance

Keep `@openrabbit/*` scope.

Examples:

- `@openrabbit/runtime-core` — shared contracts
- `@openrabbit/runtime-provider-contracts` — optional split later
- `@openrabbit/runtime-openclaw` — OpenClaw adapter package
- `@openrabbit/capability-real-estate`
- `@openrabbit/pack-real-estate`
- existing service names remain during transition

## Boundary enforcement (repo rules)

Add these as documentation now; automate later:

1. No imports from `runtimes/openclaw` outside `runtimes/openclaw` and approved shims.
2. No deep relative imports across packages (package entrypoints only).
3. Capabilities may depend on `packages/*`, `integrations/contracts`, and platform public contracts — not on app UI.
4. Apps may depend on public API clients only, not on service internals.
5. Packs contain manifests/presets, not independent business engines.

## Why this structure improves long-term outcomes

- **Scalability:** workers, capabilities, and runtimes scale as catalogs, not as entangled services.
- **Flexibility:** replacing OpenClaw or Horizons becomes an adapter/app swap.
- **Maintainability:** clear ownership reduces dual workflow/agent/skill confusion.
- **Extensibility:** industry expansion is pack installation, not repo forks.
- **Low rework:** existing services keep running while names and homes converge.
