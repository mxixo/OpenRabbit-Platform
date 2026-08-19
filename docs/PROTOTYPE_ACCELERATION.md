# OpenRabbit prototype acceleration

## Current objective

Convert the rich command-center prototype into a meeting-ready product slice without broadening scope.

## Live vertical slice now implemented

- Single-command prototype server: `npm run start:prototype`
- Command-center UI served from the same origin as the integration API
- Gmail server-side OAuth adapter using read-only scope
- Gmail connection status endpoint
- Live Gmail inbox endpoint
- Communications UI automatically swaps mock email cards for live Gmail messages when connected
- Provider-neutral agent gateway
- OpenAI Responses provider running server-side
- Live communications-agent endpoint with message/workspace context
- Server-approved Responses tool configuration through environment settings
- In-memory audit feed for agent runs
- External sends remain disabled / approval-gated

## Credentials required to light up the demo

1. Google OAuth client ID
2. Google OAuth client secret
3. Registered Gmail callback URI
4. OpenAI API key

The server can boot without either provider configured and will visibly report the missing integration rather than crashing.

## Immediate next priorities

1. Perform the first real Google OAuth connection.
2. Perform the first live OpenAI message summary inside Communications.
3. Add Google Maps / Places to the Market workspace.
4. Add HubSpot OAuth and CRM read adapter.
5. Move connection tokens from in-memory storage to durable encrypted storage.
6. Back approvals/audit events with the production execution layer.

## Scope discipline

Do not add another major product surface until the Gmail → OpenRabbit agent → recommendation → audit loop is demonstrably working with real credentials.
