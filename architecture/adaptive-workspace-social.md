# Adaptive Workspace + Social Channel

## Product decision

OpenRabbit Real Estate should center the operator around five first-class work interfaces:

1. Calendar
2. Email
3. CRM
4. Map
5. Social

These are not separate apps that force the user to navigate away from context. They are coordinated windows into the same OpenRabbit environment. The environment agent should be able to reason across all five, link records and events across them, and recommend or execute work through the appropriate interface.

`Today` remains an orchestration/read-model layer rather than becoming a sixth silo. Deals remain a specialized workflow that can be reached from CRM, Map, or direct deal views.

## Adaptive dashboard model

The default workspace should render all five interfaces at the same time. One interface is the focused centerpiece and the other four remain visible as compact widgets around it.

Initial suggested desktop composition:

- center / largest: Calendar
- left rail or left pane: Email
- right-side compact widgets: CRM + Social
- lower or remaining compact widget: Map

This is a starting arrangement, not a permanent hierarchy.

### Focus-swap interaction

- Clicking any compact widget promotes it into the centerpiece.
- The previous centerpiece collapses into a compact widget without disappearing.
- All five interfaces remain visible and contextually live.
- Focus changes should not reset filters, drafts, selected contacts, selected properties, map position, or calendar date.
- The user's last focused interface should be restorable across sessions.
- Later, users can pin a preferred default layout and resize/reorder widgets.

The goal is to make OpenRabbit feel like one adaptive operating environment rather than five disconnected tabs.

## Environment-agent behavior

The environment agent can observe and reason across the five interfaces through normalized OpenRabbit APIs and permissions. Example cross-interface flows:

- Email arrives from a buyer -> resolve CRM contact -> identify property context -> surface Map match -> suggest Calendar showing -> prepare Social follow-up content when appropriate.
- Calendar event completes -> update CRM relationship state -> summarize relevant email thread -> attach property/map context -> create follow-up tasks.
- New listing/deal appears -> match against CRM investors -> map comps/location context -> draft outreach email -> optionally create a social post.
- Social engagement creates a lead signal -> create/merge CRM lead -> connect messages or email -> schedule follow-up -> associate geographic/property context.

The agent should never need to pretend a provider is connected. Provider-specific services remain replaceable adapters behind OpenRabbit contracts.

## Social as a first-class channel

Social is not just a publishing button. It is a dedicated content and distribution workspace that supports:

- connected accounts across major social networks through provider adapters
- composer for text, image, carousel, short-form video, and link posts where supported
- per-network preview and formatting
- content calendar and posting schedule
- recurring themes/campaigns
- AI-generated draft queue
- approval queue
- publishing history and audit trail
- engagement/lead signals normalized back into CRM where provider permissions allow
- brand rules, contact information, compliance constraints, and reusable templates
- campaign/post performance summaries when APIs expose the necessary metrics

## Autonomy ladder

Social automation must be operator-controlled and reversible.

### Mode 1 — Draft only
OpenRabbit generates posts and recommendations but never schedules or publishes.

### Mode 2 — Approval required
OpenRabbit generates and schedules a proposed post. At the configured review time it remains pending until the user approves, edits, reschedules, or rejects it.

### Mode 3 — Trusted autopilot
OpenRabbit may publish within explicitly configured guardrails after the user chooses to grant that autonomy. Guardrails should include allowed accounts, content types, posting windows, frequency limits, brand rules, sensitive-topic rules, and an emergency pause.

Autopilot is never inferred merely from repeated approvals. The user explicitly enables it.

## Social workflow contract direction

A future normalized social API should separate content planning from irreversible publishing. Conceptually:

- social accounts / channel connections
- content drafts
- scheduled posts
- approval requests
- publish execution
- publish result / provider post IDs
- engagement/performance snapshots
- audit records

Publishing is an external write action and should flow through the same policy/approval/audit system used elsewhere in OpenRabbit unless the operator has explicitly enabled an applicable trusted-autopilot policy.

## Relationship to Today

Today should summarize, not replace, the five interfaces. It can surface:

- next calendar obligation
- email requiring response
- CRM follow-up at risk
- map/property opportunity
- social post awaiting approval or scheduled for publishing
- actions completed by OpenRabbit

This makes Today the decision layer while the five interfaces remain the work surfaces.

## Implementation sequence

Before deepening CRM or other individual surfaces, preserve this workspace contract in the product shell so future slices fit the same interaction model.

Recommended sequence:

1. Adaptive five-window shell + focus swapping
2. Social shell, queue, and autonomy-policy model
3. CRM normalized relationship API
4. Email + Calendar adapters and linkage
5. Map/property adapter contract
6. Cross-interface environment-agent context and actions
7. User-customizable layout persistence
