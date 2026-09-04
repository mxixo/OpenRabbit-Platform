# Pack: Real Estate

The first concrete OpenRabbit industry pack.

## Implemented now

- `manifest.js` — pack manifest
- Acquisitions Analyst worker preset
- Research Analyst worker preset
- Real Estate capability reference
- Commercial investment workflow preset

## Current composition

- capabilities: `real-estate`
- required integrations: none for the MVP path
- optional integrations recorded for later adapters: HubSpot, Rentcast, MLS, Camino
- worker presets: Acquisitions Analyst, Research Analyst
- workflow preset: `commercial-investment`

The Acquisitions Analyst can use `deal.underwrite` and defaults to an approval policy that requires human approval for consequential actions. The Research Analyst has a narrower research-oriented role.

## Installation model

The manifest matches the `IndustryPackManifest` shape in `@openrabbit/runtime-core`. A composition/bootstrap layer can register this manifest with `IndustryPackCatalog`, register the `real-estate` capability, and call `IndustryPackInstaller.install({ materializeWorkers: true })` to seed org workers.

This pack extends OpenRabbit Core; it does not fork the platform or own runtime-specific execution logic.
