# OpenRabbit Core, Packs, and Environment Contract

## Purpose

OpenRabbit is an adaptive AI operating environment, not a single-industry application. Real estate is the first production proving ground. This contract keeps reusable platform primitives in Core while allowing industry, workflow, and integration packs to shape each user's environment without forking the platform.

## 1. OpenRabbit Core

Core owns primitives that remain valid across professions and industries:

- tenant and user identity
- authentication and authorization
- permissions and approval gates
- agents, workers, orchestration, retries, and task state
- event bus, audit history, telemetry, and observability
- memory, knowledge, goals, signals, trust, and preferences
- model/provider routing and execution policy
- integration adapter registry and tool registry
- capability catalog/install lifecycle
- industry pack catalog/install lifecycle
- configuration, feature flags, migrations, and rollback metadata
- customer-safe usage metering primitives
- environment composition and presentation contracts

Core must not contain real-estate-specific entities such as listings, escrows, offers, commissions, underwriting assumptions, MLS vocabulary, or transaction stages.

### Core test

Before adding a primitive to Core, ask:

> Could this primitive serve a law firm, accounting firm, contractor, marketer, insurance agency, or another profession without importing real-estate assumptions?

If not, it belongs in a pack or capability.

## 2. Industry Packs

Industry Packs compose a useful starting environment for a profession or vertical. They may contribute:

- capabilities
- integration requirements
- worker/agent presets
- workflow presets
- dashboards and widgets
- domain terminology
- policy defaults
- automation templates
- suggested goals and review rhythms
- onboarding questions

An Industry Pack extends Core; it never creates a second orchestration, permissions, audit, identity, memory, or billing system.

Real Estate is the first Industry Pack and remains the immediate production wedge.

## 3. Tool and Integration Packs

Reusable integrations remain independent of any one industry whenever possible. Examples:

- Gmail / Outlook
- Google Calendar
- CRM adapters
- social publishing adapters
- cloud storage
- accounting systems
- messaging systems
- web/browser automation

Industry Packs may declare these as requirements or recommendations but should not own provider-specific credentials or authentication logic.

## 4. Workflow Packs

Workflow Packs package repeatable jobs that can be installed independently or alongside an Industry Pack. Examples include:

- lead intake and qualification
- daily planning and follow-up
- document intake and extraction
- approval-gated outbound communication
- social media planning, approval, and publishing
- underwriting and recommendation
- client onboarding

A workflow should reference capabilities and integrations through stable IDs rather than importing provider-specific implementations.

## 5. Environment Blueprint

The user-facing OpenRabbit environment is a composition of Core plus installed packs, connected integrations, permissions, preferences, and learned behavior.

A future environment blueprint should resolve to at least:

```ts
interface EnvironmentBlueprint {
  orgId: string;
  userId?: string;
  installedPackIds: string[];
  enabledCapabilityIds: string[];
  connectedIntegrationIds: string[];
  workerIds: string[];
  workflowIds: string[];
  surfaces: EnvironmentSurface[];
  approvalPolicyId?: string;
  modelRoutingPolicyId?: string;
  revision: number;
  generatedAt: string;
}
```

The blueprint is a projection of durable state, not a second source of truth.

## 6. Five Primary Product Surfaces

OpenRabbit should support five first-class interface surfaces while allowing packs to customize their contents:

1. **Calendar / Living Agenda** — primary operating surface, priorities, meetings, deadlines, recommended work, and agent-executed tasks.
2. **Communications** — email and messaging triage, drafting, follow-up, approvals, and relationship context.
3. **Work / CRM** — customers, leads, deals, projects, transactions, tasks, and domain-specific workflows.
4. **Intelligence / Analytics** — alerts, recommendations, underwriting, reports, trends, exceptions, and decision support.
5. **Social / Publishing** — content calendar, generation, approvals, publishing, performance signals, and automation.

These are product surfaces, not hard-coded business domains. A law firm and a real-estate agent may use the same five surfaces with different packs, terminology, widgets, permissions, and workflows.

## 7. Adaptive Onboarding

Initial setup should support two paths:

### Preset path

The user selects a profession or industry. OpenRabbit proposes an environment based on a maintained Industry Pack.

### Configure with AI

When no preset fits, onboarding gathers:

- role and business type
- goals and recurring responsibilities
- tools and data sources
- important contacts/entities
- workflows and bottlenecks
- desired automations
- approval tolerance and risk boundaries
- compliance/security constraints
- preferred dashboard surfaces

The AI then proposes a blueprint. Consequential integrations, permissions, outbound actions, and automations require explicit approval before activation.

## 8. Adaptation and Trust

OpenRabbit may learn from observed behavior and propose environment changes, but adaptation must be controlled:

- low-risk presentation changes may auto-apply when permitted
- workflow or permission changes require approval by default
- external writes remain approval-gated until trust policy explicitly allows autonomy
- every adaptive change is versioned and attributable
- users can inspect why a change was proposed or made
- rollback must restore the prior known-good environment revision

The environment should become more personalized over time without becoming opaque or irreversible.

## 9. Versioning and Anti-Obsolescence

Every pack and environment revision should carry version metadata. Platform evolution must allow:

- pack upgrades independent of Core releases where practical
- migrations with preflight validation
- compatibility ranges between packs and Core contracts
- staged rollout and rollback
- replacement of model providers and integration adapters without rewriting workflows
- deprecation windows instead of silent breaking changes

## 10. Commercial Boundary

The architecture must preserve a commercial structure such as:

- Core subscription
- Industry Packs
- premium Workflow Packs
- Integration/Tool Packs
- included usage credits and expansion usage
- custom AI-configured environments

Pricing is not encoded in pack contracts. Execution telemetry supplies the cost and usage data needed to price completed work later.

## 11. Immediate Engineering Sequence

1. Keep the Real Estate underwriting loop production-grade and end-to-end.
2. Add durable pack installation/environment composition state rather than relying only on in-memory implementations.
3. Define an Environment Blueprint projection contract in runtime-core.
4. Implement Real Estate as the reference pack using the same public pack interfaces future industries will use.
5. Expose pack/environment state through the Platform API.
6. Render the operator dashboard from resolved environment state rather than hard-coded vertical assumptions.
7. Add adaptive onboarding only after the pack and blueprint contracts are stable.
8. Add social publishing as a reusable workflow/integration capability, with approval-first automation and later trust-based autonomy.

## 12. Non-Negotiable Guardrails

- no second core inside an industry pack
- no frontend-owned business logic
- no provider-specific business workflows when an adapter boundary can be used
- no silent consequential writes
- no cross-tenant state leakage
- no hard-coded billing assumptions before telemetry validates unit economics
- no irreversible self-modification
- no adaptation without auditability, versioning, and rollback
