# Pack: Real Estate

The first concrete OpenRabbit industry pack.

## Implemented now

- `manifest.js` — pack manifest
- Acquisitions Analyst worker preset
- Research Analyst worker preset
- Real Estate capability reference
- Commercial investment workflow preset
- `environment.js` — read-only consumer for the canonical `environment_blueprint_v1` Platform contract

## Current composition

- capabilities: `real-estate`
- required integrations: none for the MVP path
- optional integrations recorded for later adapters: HubSpot, Rentcast, MLS, Camino
- worker presets: Acquisitions Analyst, Research Analyst
- workflow preset: `commercial-investment`

The Acquisitions Analyst can use `deal.underwrite` and defaults to an approval policy that requires human approval for consequential actions. The Research Analyst has a narrower research-oriented role.

## Installation model

The manifest matches the `IndustryPackManifest` shape in `@openrabbit/runtime-core`. A composition/bootstrap layer can register this manifest with `IndustryPackCatalog`, register the `real-estate` capability, and call `IndustryPackInstaller.install({ materializeWorkers: true })` to seed org workers.

## Environment consumption

The reference pack does not reconstruct tenant environment state itself. `environment.loadRealEstateEnvironment(...)` reads the same canonical `GET /v1/orgs/:orgId/environment` contract available to every future pack, verifies `environment_blueprint_v1`, enforces organization identity, and requires the Real Estate pack to be enabled in that projection. Cross-org state, unsupported payloads, disabled/missing Real Estate state, and failed API responses fail closed.

This keeps composition authority in OpenRabbit Core and the Platform API. The Real Estate pack only consumes the resolved public contract; it does not create a second permissions, orchestration, revision, or environment-state system.

This pack extends OpenRabbit Core; it does not fork the platform or own runtime-specific execution logic.
