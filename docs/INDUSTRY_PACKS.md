# OpenRabbit Industry Packs

**Status:** Canonical pack model  
**Code:** `packages/runtime-core/src/interfaces/industry-pack.ts`, `capability-module.ts`, `packs/`

---

## 1. Definition

An **Industry Pack** is a reusable bundle that extends OpenRabbit Core for a vertical market **without forking the platform**.

A pack typically includes:

- capability module ids  
- integration adapter ids  
- worker presets  
- workflow presets / templates  
- policies, metrics, and defaults  

Packs **compose**; they do not contain a second core.

---

## 2. Capability modules (building blocks)

Capabilities are installable business modules (`CapabilityModuleManifest`):

- tools, workflows, knowledge schemas  
- permissions contributions  
- required integrations  
- optional UI contribution descriptors (for CX apps—not rendered by core)  
- dependency list on other capabilities  

Org lifecycle via `CapabilityManager`: install → enable/disable → uninstall.

Dependencies are enforced (e.g. `real-estate` may depend on `crm`).

---

## 3. Pack manifest

`IndustryPackManifest` fields:

| Field | Purpose |
|---|---|
| `id`, `version`, `name` | Identity |
| `capabilities[]` | Capability module ids |
| `integrations[]` | Required integration adapter ids |
| `workerPresets?` | Workers to materialize on install |
| `workflowPresets?` | Workflow ids/templates |
| `defaults?` | Pack configuration defaults |
| `tags` / `metadata` | Classification |

Installer (`IndustryPackInstaller` / `InMemoryIndustryPackInstaller`):

1. Validate pack + version  
2. Validate integration adapters are registered (when registry provided)  
3. Install/enable each capability (respecting capability deps)  
4. Optionally materialize worker presets into `WorkerDefinition`s  
5. Record `PackInstallation` (status, created worker ids, etc.)  

**Uninstall policy:** remove pack-created workers; leave shared capabilities installed (other packs may use them). Explicit capability uninstall is a separate call.

---

## 4. How packs extend core without forking

| Do | Don't |
|---|---|
| Add manifests under `capabilities/*` and `packs/*` | Copy the monorepo per industry |
| Register integrations behind adapters | Hardcode vendor SDKs into Core services |
| Ship worker presets as data | Hardcode role classes per vertical |
| Contribute workflows/templates | Embed vertical logic only in OpenClaw prompts |
| Use Platform APIs for CX | Build a separate backend per industry |

---

## 5. Real Estate Pack (first implementation market)

### Intent

Help a real-estate operator/investor CEO run acquisitions and research with AI workers, connected CRM/data tools, and underwriting workflows.

### Suggested composition

| Slot | Example |
|---|---|
| Capabilities | `real-estate`, `crm`, `knowledge` (optional: documents, email, calendar) |
| Integrations | HubSpot (or CRM), Rentcast, MLS, email/calendar providers, Camino (optional enrichment) |
| Worker presets | Acquisitions Analyst, Research Analyst, Executive Assistant (subset) |
| Workflows | Commercial investment analysis / underwriting screening |
| Metrics | Deals screened, cap rate/DSCR distributions, outreach funnel, approval latency |

### Mapping from current MVP

| Current asset | Pack destination |
|---|---|
| `commercial_investment_workflow` skill | `capabilities/real-estate` workflow/tool |
| Camino enrichment | integration/tool behind capability |
| App-level skill runner | runtime adapter + worker task path |
| README commercial run command | pack demo script / CX flow |

Preserve behavior while moving ownership.

### Example pack install (conceptual)

```ts
installer.install({
  orgId: "org_123",
  packId: "pack.real-estate",
  materializeWorkers: true
});
// → crm + real-estate + knowledge enabled
// → acquisitions + research workers registered
// → workers.runtimePreference may include "openclaw"
```

---

## 6. Future packs (non-exhaustive)

- Construction  
- Healthcare  
- Legal / law firm  
- E-commerce  
- General SMB  

Each follows the same manifest model. No core fork.

---

## 7. Implementation status

| Item | Status |
|---|---|
| Capability + pack contracts | Done |
| In-memory catalog/manager/installer + tests | Done |
| Ownership dirs `capabilities/`, `packs/` | Done (docs) |
| Real concrete real-estate module code | Pending migration from app skill |
| Paid RE product packaging | Roadmap |

---

## Related documents

- `docs/AI_WORKERS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `capabilities/real-estate/README.md`
- `packs/real-estate/README.md`
