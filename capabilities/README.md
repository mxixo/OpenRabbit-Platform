# Capabilities (Layer 4)

Installable business capability modules.

Examples: CRM, Calendar, Email, Knowledge, Finance, Marketing, Sales, Real Estate.

## Module expectations

Each capability should eventually provide:

- `manifest` (tools, workflows, permissions, required integrations)
- optional workflow templates
- optional knowledge schemas
- tests

## Rules

1. Capabilities extend core; they do not fork it.
2. Prefer connecting external services through `integrations/` over rebuilding them.
3. Domain logic belongs here (or in packs as presets), not in runtime adapters.
4. UI contributions are descriptors for CX apps — core does not render them.

See `docs/architecture/ai-operating-environment-target-architecture.md`.
