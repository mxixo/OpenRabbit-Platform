# ADR 0001: Runtime Core is Interface-First and Mock-First
## Status
Accepted
## Context
Phase 5 requires a foundational runtime that can be shared across OpenRabbit services while avoiding premature coupling to external APIs and provider-specific SDKs.
## Decision
- Define all foundational runtime capabilities as explicit TypeScript interfaces first.
- Provide deterministic in-memory defaults for local development and unit testing.
- Provide mock implementations for model-provider and MCP boundaries.
- Defer external integrations (LLM providers, remote memory stores, MCP transports) to later phases behind the same interfaces.
## Consequences
- Positive: fast local testing, clear service boundaries, and low-risk incremental hardening.
- Positive: future provider and infrastructure swaps can be done via implementation binding changes.
- Trade-off: in-memory behavior is not production-equivalent for durability/latency characteristics and must be replaced in later phases.
