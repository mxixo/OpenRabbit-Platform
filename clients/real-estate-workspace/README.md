# OpenRabbit Real Estate Workspace

Thin browser client for the first OpenRabbit Real Estate operating environment.

## Adaptive workspace

`workspace.html` is the current interaction template for the intended product shell.

It keeps the five first-class work interfaces visible at the same time:

- **Calendar** — human schedule plus meaningful OpenRabbit worker execution.
- **Email** — professional communication, triage, action detection, and linked context.
- **CRM** — contacts, leads, relationships, pipeline, and follow-up intelligence.
- **Map** — listings, clients, comps, opportunities, appointments, routes, and geographic property context.
- **Social** — multi-network content creation, approval, scheduling, publishing, performance, and lead signals.

One interface is always the focused centerpiece while the other four remain live compact widgets. Clicking **Expand** promotes that widget into the primary workspace and collapses the previous focus without removing it. The selected focus is currently persisted in browser storage as a temporary client-side prototype; tenant/user layout persistence belongs in Platform APIs later.

The initial default is Calendar-first, but no surface is permanently privileged. This allows the environment to adapt to user preference and current task context.

`Today` is intentionally **not a sixth work app**. It is the orchestration/read-model layer above the five interfaces. The adaptive workspace top bar consumes shared summary counts while the five windows remain the actual work surfaces.

`Deals` remains a specialized workflow reachable from CRM, Map, and direct deal views rather than becoming one of the five universal windows.

## Normalized workspace view model

The adaptive shell now consumes:

`GET /v1/orgs/:orgId/workspace?date=YYYY-MM-DD`

This endpoint is the frontend-facing composition contract for the five windows. It returns:

- shared Today-style summary counts
- Calendar items normalized from OpenRabbit planning / future connected calendars
- Email items normalized independently of Gmail, Microsoft, or another provider
- CRM relationship items independently of native CRM, HubSpot, Follow Up Boss, or another provider
- Map records independently of the mapping, MLS, or property-data provider
- Social queue records plus the configured autonomy mode
- surface connection/readiness status without inventing provider data
- an optional focus recommendation for contextual adaptation

The browser templates render the normalized objects and do not need to know which provider produced them. Missing integrations render explicit `not_connected` states rather than fake content.

## Social autonomy template

Social is modeled with an explicit operator-controlled ladder:

1. **Draft only** — OpenRabbit prepares content but never schedules or publishes.
2. **Approval required** — proposed posts can be scheduled but wait for approval before external publishing.
3. **Trusted autopilot** — publishing is allowed only after the user explicitly enables it and defines applicable guardrails.

Repeated approvals never silently promote a user into autopilot.

## Existing full surfaces

`index.html` still contains the earlier full-surface shell for Today, CRM, Email, Calendar, Map, Social, and Deals while the adaptive workspace is refined. It also preserves the working deal underwriting/approval workflow.

## Other Platform APIs used

`GET /v1/orgs/:orgId/today?date=YYYY-MM-DD`

The Today endpoint composes existing platform primitives: workers, approvals, audit records, and calendar plan items. It remains useful as a dedicated orchestration feed even though the adaptive workspace endpoint now includes its summary counts.

`GET /v1/orgs/:orgId/deals/:dealId/workspace`

The Deals surface renders the current deal, underwriting KPIs, downside/base/upside scenarios, data confidence, recommendation, target purchase price, diligence items, approval state, and audit history.

The client intentionally stays thin. Business rules, permissions, workflow execution, provider selection, durable state, social publishing policy, and cross-interface context belong in Platform APIs/capabilities rather than frontend code.

For local use, serve this directory from the same origin as the platform/real-estate API (or configure an explicit API base URL and CORS policy later). `workspace.html?org=<orgId>` loads the normalized workspace model for the selected organization. Organization ID and bearer token in the older shell currently remain under Deals → Advanced connection settings until tenant-aware app bootstrap replaces developer connection controls.
