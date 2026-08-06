# Runtimes (Layer 3)

AI **runtime adapters** live here.

OpenRabbit Core depends on runtime **contracts**, never on a concrete runtime SDK.

## Layout

- `contracts/` — `RuntimeProvider` and session/task types (may re-export from `packages/runtime-core` during transition)
- `openclaw/` — OpenClaw adapter implementation only
- future runtimes get sibling folders

## Rules

1. Only `runtimes/<name>/**` may import that runtime’s proprietary SDK or env schema.
2. Platform services and capabilities must not import `runtimes/openclaw` directly except approved shims.
3. Workers select runtimes by provider id.
4. Prefer projecting platform tools into a runtime session over rebuilding tools inside the runtime.

See:

- `docs/architecture/ai-operating-environment-vision.md`
- `docs/architecture/ai-operating-environment-target-architecture.md`
