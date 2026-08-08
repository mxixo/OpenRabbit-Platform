# OpenClaw Runtime Adapter

OpenClaw is **one runtime** inside OpenRabbit, not the product.

## Status

A concrete RuntimeProvider-compatible adapter now lives here.

The first execution transport is `SkillRunnerOpenClawExecutor`, which wraps the existing OpenRabbit skill runner so current MVP behavior can move behind the runtime boundary without rewriting business logic.

Future OpenClaw CLI, MCP, or API transports should implement the same executor contract inside this directory. Core services and workers should not need to change when that transport changes.

## Responsibility

- session start/stop
- task execution
- tool projection bridge
- capability and memory-scope projection
- normalized runtime failures and task results
- event translation into platform-compatible task events

## Current files

- `openclaw-runtime-provider.js` — RuntimeProvider-compatible session/task adapter
- `skill-runner-executor.js` — compatibility bridge to the current `runner.run(skillName, input)` path
- `index.js` — runtime exports

## Compatibility path

```text
WorkerOrchestrator
  → RuntimeProvider: openclaw
  → OpenClawRuntimeProvider
  → SkillRunnerOpenClawExecutor
  → existing OpenRabbit skill runner
  → commercial_investment_workflow (and other registered skills)
```

The legacy `createOpenClawSkillRunner()` API remains available as a deprecated shim. New product-edge code should use the generic `createSkillRunner()` name or route work through WorkerOrchestrator.

## Non-goals

- defining org/worker model
- owning industry business logic
- becoming the public product API
- importing OpenClaw-specific execution details into Core services

## Next integration step

Wire `services/orchestrator` to the runtime-core `WorkerOrchestrator`, register `OpenClawRuntimeProvider`, and route new worker tasks through that path. A later transport can replace the compatibility executor with a live OpenClaw CLI/MCP/API bridge without changing the Platform-facing RuntimeProvider contract.
