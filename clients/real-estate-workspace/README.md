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

`Today` is intentionally **not a sixth work app**. It is the orchestration/read-model layer above the five interfaces. The adaptive workspace top bar can consume Today summary counts while the five windows remain the actual work surfaces.

`Deals` remains a specialized workflow reachable from CRM, Map, and direct deal views rather than becoming one of the five universal windows.

## Native CRM prototype

OpenRabbit now has a first native relationship backend behind the CRM surface. It is provider-neutral and tenant-scoped.

Current routes:

- `GET /v1/orgs/:orgId/crm/relationships`
- `POST /v1/orgs/:orgId/crm/relationships`
- `GET /v1/orgs/:orgId/crm/relationships/:relationshipId`
- `PATCH /v1/orgs/:orgId/crm/relationships/:relationshipId`
- `DELETE /v1/orgs/:orgId/crm/relationships/:relationshipId`
- `POST /v1/orgs/:orgId/crm/import`

When CRM is focused in the adaptive workspace, `crm-ui.js` adds first usable native controls: create a relationship and quickly edit stage, priority, and next follow-up. These controls call the CRM API rather than placing CRM state in browser-only storage.

The native CRM supports relationship identity, type/kind, stage, priority, follow-up date, lead source, property links, summary, email, phone, tags, and import provenance. The adaptive workspace receives a reduced provider-neutral relationship view so HubSpot, Follow Up Boss, and other CRM adapters can satisfy the same surface contract.

### CRM adapter/import boundary

`CrmRelationshipAdapter` is the provider boundary for connected CRM systems. Provider adapters translate their records into OpenRabbit's normalized relationship format instead of leaking vendor-specific fields into the dashboard.

The current import route accepts normalized records plus a provider name and supports:

- **merge** — match an existing record by provider/external ID or normalized email, then update it rather than duplicate it.
- **create_only** — create new records and skip matches.

Imported native records retain `sourceProvider` and `externalId` provenance. OAuth, provider pagination, background sync, conflict policy, and webhook/event ingestion remain future adapter implementation work.

The current native store is **in-memory development storage**, not production persistence. Durable multi-tenant storage comes later. This is deliberate: the contracts and user experience can stabilize before binding the product to a database or CRM vendor.

## Email + Calendar linkage prototype

Email now has a provider-neutral normalization boundary comparable to CRM. `EmailAdapter` translates Gmail, Microsoft, or future mail-provider messages into `WorkspaceEmailItem` records without leaking vendor-specific fields into the dashboard.

Current routes:

- `POST /v1/orgs/:orgId/email/import`
- `GET /v1/orgs/:orgId/email/messages?date=YYYY-MM-DD`
- `PATCH /v1/orgs/:orgId/email/messages/:messageId`
- `POST /v1/orgs/:orgId/email/messages/:messageId/schedule`
- `GET /v1/orgs/:orgId/email/drafts`
- `POST /v1/orgs/:orgId/email/drafts`
- `PATCH /v1/orgs/:orgId/email/drafts/:draftId`
- `GET /v1/orgs/:orgId/connections`
- `PUT /v1/orgs/:orgId/connections/:provider`
- `POST /v1/orgs/:orgId/connections/:provider/authorize`
- `POST /v1/orgs/:orgId/connections/:provider/callback`
- `DELETE /v1/orgs/:orgId/connections/:provider`

Provider imports are idempotent by provider + external message ID. Normalized messages can carry `relationshipId` and `propertyId`, allowing the same email to remain linked to CRM and Map/property context.

The scheduling route converts an email with scheduling intent into an OpenRabbit calendar plan item through the existing planning backend. The resulting calendar metadata preserves the email message, provider/external ID, relationship, and property links. Once scheduled, the email's pending scheduling action is cleared.

When Email is focused, `email-ui.js` exposes the first cross-interface action: a recognized scheduling email can be given a start/end time and added to Calendar from inside the Email surface. This is the first concrete implementation of the intended **Email → CRM/context → Calendar → Today** operating loop.

### Delegated provider connection and OAuth bootstrap

`DelegatedAuthorizationAdapter` defines the OAuth/delegated authorization boundary for Google, Microsoft, and future providers. Google and Microsoft adapter factories now implement standards-based authorization URL construction, capability-to-scope mapping, PKCE, one-time authorization state, token exchange through an injectable HTTP client, and credential handoff through a dedicated secret-store boundary.

The connection registry stores only user-visible status, granted capability/scope metadata, account label, and sync health. **Access and refresh tokens are deliberately excluded** from connection records and workspace APIs.

`ProviderCredentialStore` is the secret-bearing boundary. The included in-memory implementation is for tests/development only and is explicitly not encrypted at rest or durable. Production should use KMS/HSM-backed envelope encryption or a managed secret store. This separation lets OpenRabbit expose connection health without leaking credentials into logs, browser payloads, or normal platform state.

Connections declare granular capabilities such as `email.read`, `email.draft`, `email.send`, `calendar.read`, and `calendar.write`. This supports onboarding choices such as “read + draft email, but require approval to send.”

OAuth begin/callback/revoke routes operate only when a provider authorization adapter has been registered with the API gateway. Unconfigured providers fail closed with `PROVIDER_AUTH_NOT_CONFIGURED` rather than pretending a connection exists.

### Draft/reply safety boundary

`EmailDraft` creates a normalized outbound queue with explicit states: `draft`, `pending_approval`, `approved`, `sent`, and `discarded`. A worker can prepare a reply and mark it pending approval without being granted implicit permission to send it. `EmailSendAdapter` is the future provider boundary for creating provider-native drafts and sending approved drafts.

`CalendarAdapter` is defined separately from OpenRabbit's planning kernel. Google/Microsoft calendars can synchronize selected plan items, while the OpenRabbit timeline remains the provider-neutral operating model.

Like native CRM, the current normalized email, draft, connection, and development credential stores are in-memory. Provider pagination/delta sync, webhook/watch subscriptions, production encrypted credential custody, and provider-native outbound delivery remain future work.

## Map / property intelligence prototype

The Map surface now has a provider-neutral property record model and API boundary. `PropertyAdapter` is intended for MLS/property/geospatial implementations such as a future Flexmls adapter, while the dashboard consumes normalized records rather than provider-specific payloads.

Current routes:

- `POST /v1/orgs/:orgId/map/import`
- `GET /v1/orgs/:orgId/map/items`
- `GET /v1/orgs/:orgId/map/items/:itemId`
- `GET /v1/orgs/:orgId/map/items?north=...&south=...&east=...&west=...`

Normalized property records can preserve provider/external ID, MLS ID, coordinates, address, price, property type, beds/baths/units, status, CRM relationship links, listing URL, Street View URL, and provider-specific metadata. Imports are idempotent by provider + external ID.

`map-ui.js` provides the first real focused Map renderer. It plots normalized coordinates into a lightweight provider-neutral canvas, supports selecting individual property markers, and shows a property inspector with price, MLS/context, and optional Street View/listing links. This is deliberately **not** pretending to be Google Maps or an MLS map yet: real map tiles, geocoding, routing, Street View embedding, and Flexmls/MLS feeds remain replaceable provider integrations behind the existing contracts.

The current property store is in-memory development storage. It exists to stabilize the property/geospatial contract and cross-surface behavior before binding OpenRabbit to an MLS or mapping vendor.

## Social autonomy template

Social is modeled with an explicit operator-controlled ladder:

1. **Draft only** — OpenRabbit prepares content but never schedules or publishes.
2. **Approval required** — proposed posts can be scheduled but wait for approval before external publishing.
3. **Trusted autopilot** — publishing is allowed only after the user explicitly enables it and defines applicable guardrails.

Repeated approvals never silently promote a user into autopilot.

## Existing full surfaces

`index.html` still contains the earlier full-surface shell for Today, CRM, Email, Calendar, Map, Social, and Deals while the adaptive workspace template is refined. It also preserves the working deal underwriting/approval workflow.

## Platform APIs used

`GET /v1/orgs/:orgId/workspace?date=YYYY-MM-DD`

The adaptive workspace endpoint returns one normalized provider-neutral model for Calendar, Email, CRM, Map, and Social. Native CRM, normalized email, and normalized property/map records already flow through this contract.

`GET /v1/orgs/:orgId/today?date=YYYY-MM-DD`

The Today endpoint composes existing platform primitives instead of moving business logic into the browser: workers, approvals, audit records, and calendar plan items.

`GET /v1/orgs/:orgId/deals/:dealId/workspace`

The Deals surface renders the current deal, underwriting KPIs, downside/base/upside scenarios, data confidence, recommendation, target purchase price, diligence items, approval state, and audit history.

The client intentionally stays thin. Business rules, permissions, workflow execution, provider selection, durable state, social publishing policy, and cross-interface context belong in Platform APIs/capabilities rather than frontend code.

For local use, serve this directory from the same origin as the platform/real-estate API (or configure an explicit API base URL and CORS policy later). `workspace.html?org=<orgId>` can load the normalized workspace for the selected organization. Organization ID and bearer token in the older shell currently remain under Deals → Advanced connection settings until tenant-aware app bootstrap replaces developer connection controls.
