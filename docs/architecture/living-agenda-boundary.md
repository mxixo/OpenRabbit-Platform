# Living Agenda Architecture Boundary

## Decision

Living Agenda is a first-class OpenRabbit product that must remain independently deployable while reusing shared OpenRabbit execution intelligence.

This document defines the boundary intended to prevent the consumer product from becoming inseparable from OpenRabbit's business/real-estate application surfaces.

## Layer model

### Shared OpenRabbit execution core

Reusable, provider-neutral packages own concepts such as:

- goals and outcomes
- priority scoring
- plan generation
- plan reconciliation
- execution events
- behavioral observations
- capacity and duration models
- approvals where applicable
- audit/history

This layer must not depend on a specific consumer UI, calendar vendor, industry pack, or runtime provider.

### Living Agenda application layer

The standalone application composes the shared core for an individual-user experience. It owns consumer-specific behavior such as:

- personal onboarding
- personal goal setup
- agenda presentation
- swipe/check-in UX contracts
- consumer notification policy
- well-being preference surfaces
- personal progress/execution-maturity presentation
- consumer privacy controls

### OpenRabbit organization application layer

The business product composes shared execution concepts at organization scope. It owns:

- departments
- organization workers
- industry packs
- CEO attention views
- organization approvals
- enterprise integrations
- organization policy

## Dependency direction

Allowed:

Living Agenda App -> Shared Execution Core

OpenRabbit Business App -> Shared Execution Core

Shared Execution Core -> provider-neutral interfaces

Provider adapters -> external calendars / runtimes / CRMs / messaging systems

Disallowed:

Shared Execution Core -> Living Agenda UI

Shared Execution Core -> real-estate pack

Living Agenda App -> real-estate pack

Living Agenda App -> mandatory OpenClaw runtime

## Source of truth

External calendars are not the source of truth for Living Agenda intelligence.

The normalized OpenRabbit plan/execution model is the intelligence source of truth. Calendar adapters synchronize commitments and presentation where authorized.

## Deployment target

The architecture should permit at least these deployments without rewriting core logic:

1. Living Agenda standalone mobile/web application
2. OpenRabbit business application with embedded Living Agenda planning capabilities
3. OpenRabbit organization/CEO dashboard using organization-scoped planning and execution intelligence

## Data isolation

Consumer behavioral data should be modeled so that personal observations can remain personal even when a user later connects an organization.

Organization-level analytics should not implicitly expose private personal behavioral signals to employers, managers, departments, or organization dashboards.

Any future cross-scope sharing should be explicit and purpose-limited.

## Behavioral intelligence boundary

The core may derive observations such as duration distributions, completion patterns, deferrals, interruption/recovery latency, and goal drift.

The interpretation layer must distinguish observation from inference. For example:

Observed: check-in occurred 187 minutes after scheduled end.

Not automatically asserted: user procrastinated for 187 minutes.

This boundary is required for both product quality and responsible personalization.

## Well-being boundary

The planner may optimize within user-declared goals and constraints, but it must not silently remove rest, health, family, accessibility, or other chosen constraints merely to increase throughput.

Well-being is a planning constraint and outcome dimension, not a cosmetic dashboard metric.

## Evolution strategy

Build behavioral intelligence in shared, testable contracts first. Add consumer UX and provider adapters around those contracts later.

The immediate technical sequence is:

Execution Events -> Check-in/Undo -> Continuity/Recovery -> Duration Learning -> Capacity -> Drift -> Well-being Constraints -> Optional Execution Maturity
