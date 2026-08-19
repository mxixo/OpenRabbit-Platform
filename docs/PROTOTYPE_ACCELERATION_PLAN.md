# OpenRabbit Prototype Acceleration Plan

## Objective
Turn the existing command-center UI into a meeting-ready prototype with at least one real OAuth integration, one real map/data integration, and one real AI/agent execution path without sacrificing the approval-first architecture.

## Prototype definition of done
A credible prototype should demonstrate one complete loop:

1. User opens OpenRabbit.
2. User connects Gmail with OAuth.
3. OpenRabbit reads a limited real inbox view and links a conversation to CRM/deal context.
4. User asks the OpenRabbit agent to summarize or recommend a follow-up.
5. The agent may use its configured tools through the agent gateway.
6. OpenRabbit prepares a draft action.
7. Any external write/send is approval-gated.
8. The action and approval result are recorded in audit history.
9. The Market workspace renders a real Google map / Places-backed surface.

HubSpot OAuth is the second direct integration and should populate CRM contacts/deals after the Gmail loop is stable.

## Architecture

### 1. OpenRabbit Environment Layer
Owns:
- user/session identity
- workspace/deal context
- permissions
- connected accounts
- approval policy
- audit history
- UI state

It should NOT assume a specific reasoning model.

### 2. Agent Gateway
OpenRabbit passes the selected context to a configured agent provider. A provider can expose its own tools and OpenRabbit can also expose approved first-party tools.

Provider contract:
- `run({input, context, tools, policy})`
- return structured response, proposed actions, tool trace metadata
- never bypass OpenRabbit approval policy for external writes

Initial provider: OpenAI Responses API / agent-compatible provider.
Future providers can be added behind the same interface.

### 3. Direct Integration Adapters
Direct adapters exist where deterministic application behavior is preferable to agent-only access:
- Gmail: OAuth 2.0 + Gmail REST API
- HubSpot: OAuth + CRM APIs
- Google Maps/Places: Maps JavaScript API / Places API with restricted API key

These adapters can also be exposed to the agent gateway as callable tools.

### 4. Tool Inheritance Principle
OpenRabbit should not duplicate every tool an upstream agent already has. If the configured agent/provider supports tools (built-ins, functions, remote MCP, etc.), OpenRabbit passes or references the permitted tool configuration and lets the provider reason with those tools. OpenRabbit remains the policy boundary for credentials, high-risk operations, approvals, and audit history.

## Critical build order

### Gate A — shared backend integration service
- connection registry
- encrypted-token storage abstraction
- OAuth state + callback handling
- provider health/status endpoints
- approval policy object

### Gate B — Gmail real connection
- Connect Gmail button
- OAuth callback
- refresh-token persistence
- read-only inbox scope for first demo
- fetch latest threads/messages
- map Gmail thread metadata into communications workspace

### Gate C — OpenAI agent gateway
- provider interface
- OpenAI provider implementation
- context packet from current OpenRabbit workspace
- tool configuration passthrough / function-tool registry
- structured proposed-action response

### Gate D — Google Maps real surface
- restricted browser API key
- real Phoenix map
- markers from OpenRabbit property records
- Places search/autocomplete for property/location research

### Gate E — HubSpot OAuth
- install/authorize flow
- token refresh
- read contacts/deals
- map records into CRM workspace

### Gate F — approval + audit loop
- all external writes become proposed actions
- operator approval
- execute through direct adapter or delegated agent tool
- record actor, provider, tool, input summary, approval, result, timestamp

## Meeting demo narrative
Use one story instead of showcasing every screen:

1. Open the CEO Calendar.
2. Open Communications and show real Gmail data.
3. Select an important email tied to a deal/contact.
4. Ask OpenRabbit: "What should I do next?"
5. Agent summarizes context across the inbox + CRM/deal packet and proposes a reply/follow-up.
6. Show approval before send.
7. Open Market and show the property on a real Google map.
8. Open the CRM/deal workspace and show the unified timeline/audit trail.

This proves the core thesis: OpenRabbit is one environment coordinating tools, data, agent reasoning, and controlled action.