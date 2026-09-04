# Hostinger Horizons Boundary

**Status:** Implementation guidance; canonical architecture remains `docs/ARCHITECTURE.md` and `docs/PRINCIPLES.md`.

## Purpose

Hostinger Horizons is a customer-experience client and rapid frontend/prototype accelerator for OpenRabbit. It is not the source of truth for platform business logic, workflows, model/runtime behavior, or long-term connector ownership.

## Allowed Hostinger responsibilities

- Web UI and responsive layouts
- Onboarding and connection UX
- Presenting live email/calendar/CRM/map/social data
- Initiating OAuth and displaying connection state
- Temporary prototype connector logic when needed to prove a provider flow
- Calling versioned OpenRabbit Platform APIs

## Responsibilities that must converge into Platform APIs

- Agent/worker orchestration
- Tool registry and normalized tool contracts
- Workflow execution semantics
- Durable memory policy
- Approval/autonomy policy
- Audit/event semantics
- Provider-independent integration contracts
- Cross-client behavior shared by web, mobile, desktop, and CLI

## Rule for prototype connectors

A connector implemented first in Horizons is acceptable as a proving implementation. Before it becomes a permanent production dependency, OpenRabbit must document its scopes, callback URLs, token lifecycle, request/response shapes, errors, and provider capabilities, then reconcile it with the canonical IntegrationAdapter/tool contracts in GitHub.

Do not maintain independent permanent Gmail/Calendar/HubSpot implementations in Horizons, desktop, and backend. Each capability should converge on one canonical backend implementation behind stable APIs.

## Target request path

```text
Hostinger Web App
    -> versioned OpenRabbit Platform API
    -> OpenRabbit Core / WorkerOrchestrator
    -> Tool Registry / Workflow facade / Policy
    -> IntegrationAdapter
    -> Gmail / Calendar / HubSpot / Maps / Social
```

## Migration rule

Preserve a working Horizons flow while moving ownership behind Platform APIs. Prefer adapter/shim migration over big-bang rewrites. The frontend should not need redesign when connector ownership moves from Horizons to the OpenRabbit backend.
