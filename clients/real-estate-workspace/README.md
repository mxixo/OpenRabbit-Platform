# OpenRabbit Real Estate Workspace

Thin browser client for the first OpenRabbit Real Estate operating environment.

## Current surfaces

- **Today** — live read model for pending approvals, audited agent activity, active workers, and scheduled plan items.
- **CRM** — first-class relationship surface; live CRM adapters/native CRM are the next product slice.
- **Email** — communication surface prepared for provider-backed inbox context and action suggestions.
- **Calendar** — shared human schedule + OpenRabbit worker activity concept.
- **Map** — provider-agnostic property intelligence surface for future MLS/property/geospatial adapters.
- **Deals** — working underwriting, scenario, recommendation, diligence, approval, and audit workspace.

## Platform APIs used

`GET /v1/orgs/:orgId/today?date=YYYY-MM-DD`

The Today endpoint composes existing platform primitives instead of moving business logic into the browser: workers, approvals, audit records, and calendar plan items.

`GET /v1/orgs/:orgId/deals/:dealId/workspace`

The Deals surface renders the current deal, underwriting KPIs, downside/base/upside scenarios, data confidence, recommendation, target purchase price, diligence items, approval state, and audit history.

The client intentionally stays thin. Business rules, permissions, workflow execution, provider selection, and durable state belong in Platform APIs/capabilities rather than frontend code.

For local use, serve this directory from the same origin as the platform/real-estate API (or configure an explicit API base URL and CORS policy later). Organization ID and bearer token currently live under Deals → Advanced connection settings until tenant-aware app bootstrap replaces the developer connection controls.
