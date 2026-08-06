# OpenClaw Runtime Adapter

OpenClaw is **one runtime** inside OpenRabbit, not the product.

## Responsibility

Implement `RuntimeProvider` for OpenClaw:

- session start/stop
- task execution
- tool projection bridge
- event translation into platform events

## Non-goals

- defining org/worker model
- owning industry business logic
- becoming the public product API
- being imported by CX apps

## Migration note

Existing OpenRabbit app helpers such as `createOpenClawSkillRunner` should become deprecated shims over this adapter.
