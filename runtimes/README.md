# Runtimes (Layer 3)

AI **runtime adapters** live here.

OpenRabbit Core depends on runtime **contracts** from `@openrabbit/runtime-core`
(`RuntimeProvider`, session/task types), never on a concrete runtime SDK.

## Layout

- `contracts/` — notes / re-exports guidance for runtime-agnostic provider contracts
- `openclaw/` — OpenClaw adapter implementation only (future)
- future runtimes get sibling folders

## Canonical TypeScript contracts

Implemented in `packages/runtime-core`:

- `RuntimeProvider`, `RuntimeProviderRegistry`
- `RuntimeSession`, `RuntimeTaskRequest`, `RuntimeTaskResult`
- `MockRuntimeProvider` (test double — not a production adapter)

## Rules

1. Only `runtimes/<name>/**` may import that runtime’s proprietary SDK or env schema.
2. Platform services and capabilities must not import `runtimes/openclaw` directly except approved shims.
3. Workers select runtimes by provider id via `runtimePreference`.
4. Prefer projecting platform tools into a runtime session over rebuilding tools inside the runtime.
