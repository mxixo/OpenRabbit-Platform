# OpenRabbit meeting-ready prototype runbook

## Prototype definition of done

This prototype is considered complete when the application can be launched from one Node process and demonstrates the following architecture:

1. Command Center with Calendar, CRM, Communications, Market, Social, and OpenRabbit agent surfaces.
2. Server-side OpenAI Responses provider behind a provider-neutral agent gateway.
3. Gmail OAuth with read-only inbox access.
4. HubSpot OAuth or private-app read access for contacts and deals.
5. Gmail sender → HubSpot contact matching inside Communications.
6. Google Maps live rendering when a restricted browser key is present.
7. Human approval queue and auditable approve/reject decisions.
8. Graceful mock fallback for integrations that are not credentialed.

External sends/writes are intentionally not part of this prototype definition of done.

## Local setup

```bash
cp .env.example .env
npm install
npm run preflight:prototype
npm test
npm run start:prototype
```

Open:

- Command Center: `http://localhost:8787/`
- Connections: `http://localhost:8787/connections.html`
- Communications: `http://localhost:8787/communications.html`
- CRM: `http://localhost:8787/crm.html`
- Market: `http://localhost:8787/market.html`
- Approvals & Audit: `http://localhost:8787/audit.html`

## Provider configuration

### OpenAI

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. The browser never receives the API key. Optional Responses API tools are supplied only from the server through `OPENRABBIT_OPENAI_TOOLS_JSON`.

### Gmail

Configure a Google OAuth web client and register the exact callback:

`http://localhost:8787/api/integrations/gmail/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The prototype requests read-only Gmail access.

### HubSpot

Preferred: configure an OAuth app with contact/deal read scopes and register:

`http://localhost:8787/api/integrations/hubspot/callback`

Set `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET`.

For a single-account internal demo, `HUBSPOT_ACCESS_TOKEN` can be used instead.

### Google Maps

Set `GOOGLE_MAPS_BROWSER_KEY`. Restrict the browser key by HTTP referrer and enable only the Maps/Places services required by the demo.

## Recommended meeting flow

1. Open Connections and show integration truth/status.
2. Open Command Center and ask OpenRabbit a general question to prove the global agent gateway.
3. Open Communications and connect Gmail.
4. Select a real Gmail message.
5. If HubSpot is connected, show the automatic CRM contact match.
6. Click Summarize to send Gmail + HubSpot context to OpenRabbit.
7. Ask for a reply/next action.
8. Put a drafted message into the approval queue.
9. Open Approvals & Audit and approve/reject it; show the audit event.
10. Open CRM and show live HubSpot contacts/deals.
11. Open Market and show the live Google map with property markers if configured.
12. Return to the Command Center and explain that the other surfaces use the same environment/agent architecture.

## Known prototype boundaries

- OAuth token storage is in-memory and resets when the prototype server restarts.
- Gmail and HubSpot are read-only for the prototype.
- Approval does not execute an external send yet; it records the human decision and audit trace.
- Social, some Calendar data, and non-Gmail communication channels are intentionally simulated.
- Authentication is single-user prototype mode; production identity/tenant isolation is a post-prototype layer.

These boundaries are intentional scope controls, not hidden failures. They preserve a credible live vertical slice while avoiding premature production permissions.
