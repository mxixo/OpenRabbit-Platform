# OpenClaw Runtime Adapter

OpenClaw is **one runtime** inside OpenRabbit, not the product.

## Status

A concrete RuntimeProvider-compatible adapter now lives here.

The first execution transport is `SkillRunnerOpenClawExecutor`, which wraps the existing OpenRabbit skill runner so current MVP behavior can move behind the runtime boundary without rewriting business logic.

`OpenClawProcessExecutor` adds a configurable live-process transport foundation. It launches a configured command, writes the normalized task and runtime context to stdin as JSON, enforces the task timeout, and expects a normalized JSON execution result on stdout. The concrete OpenClaw CLI command and arguments remain deployment configuration rather than Platform or Core behavior.

Future OpenClaw MCP or API transports should implement the same executor contract inside this directory. Core services and workers should not need to change when that transport changes.

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
- `process-executor.js` — configurable JSON-over-stdio process transport foundation for a live OpenClaw command
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

## Process transport path

```text
WorkerOrchestrator
  → RuntimeProvider: openclaw
  → OpenClawRuntimeProvider
  → OpenClawProcessExecutor
  → configured OpenClaw process
  ↔ JSON over stdin/stdout
```

The legacy `createOpenClawSkillRunner()` API remains available as a deprecated shim. New product-edge code should use the generic `createSkillRunner()` name or route work through WorkerOrchestrator.

## Non-goals

- defining org/worker model
- owning industry business logic
- becoming the public product API
- importing OpenClaw-specific execution details into Core services
- hard-coding a deployment-specific OpenClaw command or transport protocol outside this runtime adapter

## Current integration state

`services/orchestrator` is now wired to the runtime-core `WorkerOrchestrator`, and the Real Estate platform backend routes worker tasks through the supported worker execution path. Human approval enforcement and the in-memory approval lifecycle are also available through Platform API routes.

The runtime now has both the compatibility skill-runner executor and a configurable process executor foundation. The next runtime-specific deployment step is to bind the process executor to the verified OpenClaw CLI contract in the target environment, or add a dedicated MCP/API executor behind the same contract, while keeping Core and Platform APIs unchanged.
