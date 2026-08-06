# @openrabbit/runtime-core

Shared contracts and in-memory/default implementations for OpenRabbit Platform.

## Runtime & Worker abstractions

- `RuntimeProvider` / `RuntimeProviderRegistry` — pluggable AI runtimes (OpenClaw is an adapter, not core)
- `WorkerDefinition` / `WorkerRegistry` / `WorkerOrchestrator` — configurable AI employees
- `MockRuntimeProvider` — test double only

Workers select runtimes through `runtimePreference` and receive allow-listed tool projections.

## Capability & Pack abstractions

- `CapabilityModuleManifest` / `CapabilityCatalog` / `CapabilityManager` — installable business modules
- `IntegrationAdapter` / `IntegrationAdapterRegistry` — external connectors (MCP is one kind)
- `IndustryPackManifest` / `IndustryPackCatalog` / `IndustryPackInstaller` — compose capabilities + workers

Packs extend core; they do not fork it. Installers may materialize `WorkerPreset`s into org workers.
