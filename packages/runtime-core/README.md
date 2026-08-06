# @openrabbit/runtime-core

Shared contracts and in-memory/default implementations for OpenRabbit Platform.

## Runtime & Worker abstractions

- `RuntimeProvider` / `RuntimeProviderRegistry` — pluggable AI runtimes (OpenClaw is an adapter, not core)
- `WorkerDefinition` / `WorkerRegistry` / `WorkerOrchestrator` — configurable AI employees
- `MockRuntimeProvider` — test double only

Workers select runtimes through `runtimePreference` and receive allow-listed tool projections.
