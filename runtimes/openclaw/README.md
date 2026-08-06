# OpenClaw Runtime Adapter

OpenClaw is **one runtime** inside OpenRabbit, not the product.

## Status

Skeleton only. Implement `RuntimeProvider` from `@openrabbit/runtime-core` here in a follow-up.

## Responsibility

- session start/stop
- task execution
- tool projection bridge
- event translation into platform events

## Non-goals

- defining org/worker model
- owning industry business logic
- becoming the public product API
