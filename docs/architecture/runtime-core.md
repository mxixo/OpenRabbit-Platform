# Runtime Core Architecture
## Purpose
`packages/runtime-core` defines the foundational runtime contracts and default local implementations used by future OpenRabbit services.

The package is intentionally interface-first:
- contracts in `src/interfaces/`
- default in-memory implementations in `src/core/`
- mock adapters in `src/mocks/`

## Core components
- Configuration Manager: layered config read/write with validation hooks.
- DI Container: token-based service registration and resolution with lifecycle control.
- Event Bus: in-process pub/sub with fault-isolated handlers.
- Logging: structured logger with pluggable sinks and contextual child loggers.
- Permission Manager: deterministic policy evaluator with deny precedence.
- Tool Registry: tool metadata + invocation registry.
- Agent Registry: agent metadata, capability, status, and tag lookup registry.
- Model Provider abstraction: provider-neutral model invocation contract.
- Memory interface: namespace/session-scoped memory CRUD + search contract.
- MCP interface: transport-agnostic MCP request/tool interaction contract.

## Boundaries and non-goals (Phase 5)
- No external API wiring or provider SDK integration.
- No persistence backends beyond in-memory implementations.
- No runtime network transport; MCP and model calls use mocks.

## Integration model
Future services should depend on runtime-core interfaces and inject implementations through the DI container. As production adapters are introduced, they should replace only implementation bindings, not interface contracts.
