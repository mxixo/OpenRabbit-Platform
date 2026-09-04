# OpenRabbit Capability Registry

## Purpose

The capability registry is the platform contract between the OpenRabbit environment and the providers, tools, agents, models, and external services that perform work.

OpenRabbit should reason in terms of **capabilities**, not vendors. A user asks the environment to send an email, schedule a meeting, analyze a deal, update a CRM record, or publish a social post. The runtime decides which approved provider can satisfy that capability.

This prevents the product from becoming tightly coupled to any single model, SaaS vendor, MCP server, API, or infrastructure provider.

## Core principles

1. **Capability-first** — product workflows depend on stable capability IDs, never directly on vendor names.
2. **Provider-swappable** — multiple providers may implement the same capability.
3. **Tenant-bound** — credentials, permissions, preferences, and policy are resolved per tenant and actor.
4. **Approval-aware** — every capability declares whether execution is read-only, draft-only, approval-gated, or autonomous.
5. **Observable** — every execution emits telemetry with tenant, actor, capability, provider, attempt, result, and latency.
6. **Versioned** — capability contracts and provider adapters use explicit versions.
7. **Rollback-safe** — provider changes are reversible and previous compatible versions remain addressable.
8. **Graceful degradation** — when the preferred provider fails, the runtime may use an approved fallback or return a structured unavailable state.

## Canonical capability domains

OpenRabbit's primary operating environment is organized around five persistent interfaces:

- `calendar.*` — schedule, availability, reminders, meetings, deadlines, and time-based workflows.
- `mail.*` — read, classify, summarize, draft, send, reply, archive, and follow-up workflows.
- `work.*` — CRM, real-estate deals, projects, records, documents, underwriting, tasks, and business operations.
- `communications.*` — SMS, chat, messaging, contacts, calls, and relationship workflows.
- `social.*` — create, review, schedule, publish, monitor, and analyze social content.

The environment may add domains later without changing the fundamental registry contract.

## Capability descriptor

Each registered capability should expose at minimum:

```json
{
  "capability_id": "mail.send",
  "contract_version": "1.0.0",
  "risk_level": "write_external",
  "default_execution_policy": "approval_required",
  "input_schema": "schemas/mail-send-input.v1.json",
  "output_schema": "schemas/mail-send-output.v1.json",
  "providers": ["gmail", "hostinger_mail"],
  "supports_dry_run": true,
  "supports_idempotency": true,
  "emits_telemetry": true
}
```

## Provider adapter descriptor

A provider adapter declares which stable capabilities it implements:

```json
{
  "provider_id": "gmail",
  "adapter_version": "1.0.0",
  "capabilities": [
    "mail.search",
    "mail.read",
    "mail.draft",
    "mail.send",
    "mail.reply",
    "mail.archive"
  ],
  "credential_scope": "tenant",
  "healthcheck": true,
  "priority": 100
}
```

## Execution policy

Canonical execution policies:

- `read_only` — no external mutation.
- `draft_only` — produces a proposed action but cannot execute it.
- `approval_required` — execution requires explicit human approval.
- `policy_autonomous` — execution is allowed only when a tenant policy explicitly grants autonomy for the capability and conditions.

No provider can weaken the platform policy. Provider-level permissions are an additional constraint, not a replacement for OpenRabbit policy.

## Runtime resolution

For each execution, the runtime should:

1. Resolve tenant and authenticated actor.
2. Resolve the requested stable capability ID.
3. Evaluate tenant policy and approval requirements.
4. Identify enabled provider adapters capable of satisfying the request.
5. Rank providers using tenant preference, health, compatibility, cost, reliability, and policy.
6. Execute through the selected adapter.
7. Emit execution telemetry.
8. If execution fails, apply the capability's fallback policy.
9. Record the final outcome and provider used.

## Provider selection

Initial provider selection can be deterministic. A future scoring function may evaluate:

`provider_score = preference + health + reliability + compatibility + latency + cost_fit`

Cost optimization must never override security, data-boundary, contractual, or tenant-policy requirements.

## Fallback behavior

Fallback is capability-specific.

Examples:

- `mail.read`: automatic fallback may be safe if multiple configured mail providers represent the requested mailbox.
- `mail.send`: fallback must not send through a different identity unless the user or tenant explicitly permits it.
- `social.publish`: fallback may change API transport but must preserve the intended account, content, scheduling rules, and approval state.
- `work.underwrite`: model/provider fallback is allowed only when the resulting output passes the same canonical underwriting contract and validation rules.

## Idempotency

All mutating capabilities should support an idempotency key where technically possible. OpenRabbit must prevent retries from creating duplicate emails, meetings, CRM records, social posts, or financial/workflow actions.

## Registry states

A provider implementation may be:

- `available`
- `degraded`
- `disabled`
- `incompatible`
- `retired`

Retired adapters remain identifiable in historical telemetry so prior executions remain explainable.

## Compatibility and evolution

Capability contracts follow semantic versioning.

- Patch: implementation or validation correction without contract change.
- Minor: backward-compatible optional fields or behavior.
- Major: breaking contract change.

The environment should support concurrent major versions during migrations whenever feasible.

## Relationship to OpenRabbit product doctrine

The registry operationalizes the adaptive-environment and anti-obsolescence principles:

- OpenRabbit remains the stable user environment.
- Models and SaaS products become replaceable implementation components.
- User workflows, policy, context, telemetry, approvals, and history remain durable.
- New technology can be adopted incrementally without rewriting the product or disrupting users.

## Initial implementation sequence

1. Define the machine-readable registry schema.
2. Register existing real-estate/underwriting capabilities.
3. Wrap current integrations behind provider adapters.
4. Add runtime capability resolution.
5. Add provider health and fallback state.
6. Surface capabilities and connection health in the operator environment.
7. Extend the registry to the five primary interfaces.

## Non-goals

The registry does not decide the product UI, replace workflow orchestration, store raw credentials, or allow arbitrary autonomous execution. It is the stable contract and routing layer beneath those systems.
