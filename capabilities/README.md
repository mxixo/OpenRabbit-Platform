# Capabilities (Layer 4)

Installable business capability modules.

Canonical TypeScript contracts live in `@openrabbit/runtime-core`:

- `CapabilityModuleManifest`
- `CapabilityCatalog` / `InMemoryCapabilityCatalog`
- `CapabilityManager` / `InMemoryCapabilityManager`

## Module expectations

Each capability should eventually provide:

- manifest (tools, workflows, permissions, required integrations)
- optional workflow templates
- optional knowledge schemas
- tests

## Rules

1. Capabilities extend core; they do not fork it.
2. Prefer connecting external services through integrations over rebuilding them.
3. Domain logic belongs here (or in packs as presets), not in runtime adapters.
4. UI contributions are descriptors for CX apps — core does not render them.
5. Org install/enable state is managed via `CapabilityManager` (per-tenant).
