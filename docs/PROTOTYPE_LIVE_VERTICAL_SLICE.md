# OpenRabbit live vertical slice

## Demo goal

Show one credible end-to-end loop with real data and a real reasoning provider:

1. Start OpenRabbit from one command.
2. Open the Communications workspace.
3. Connect Gmail through OAuth.
4. Replace mock email cards with live Gmail inbox messages.
5. Select a real message.
6. Ask OpenRabbit to summarize or recommend the next action.
7. Send selected message context to the server-side OpenAI Responses provider.
8. Display the real agent result in the OpenRabbit drawer.
9. Record the agent run in the prototype audit feed.
10. Keep all external write/send actions approval-gated.

## Start

```bash
cp .env.example .env
# Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and OPENAI_API_KEY.
npm install
npm run start:prototype
```

Open `http://localhost:8787`.

## Google OAuth callback

Register this exact development redirect URI in Google Cloud:

`http://localhost:8787/api/integrations/gmail/callback`

For a hosted demo, set `OPENRABBIT_APP_ORIGIN` and `GOOGLE_REDIRECT_URI` to the HTTPS deployment URL and register the hosted callback with Google.

## Safety posture

- Gmail starts with `gmail.readonly`.
- OAuth state is single-use and time-limited.
- OpenAI API keys remain server-side.
- Browser requests cannot supply arbitrary provider tool definitions.
- Optional Responses API tools are configured by the server through `OPENRABBIT_OPENAI_TOOLS_JSON`.
- The current connection store is in-memory; reconnect after a server restart. Persistent encrypted token storage is a post-demo hardening item.
- Sending email is intentionally not enabled in this vertical slice.

## Next live integrations

1. Google Maps JavaScript / Places for the Market workspace.
2. HubSpot OAuth for CRM contacts and deals.
3. Durable encrypted OAuth token storage.
4. Approval records backed by the existing audit/execution layer.
5. Gmail send only after the approval execution path is complete.
