# OpenRabbit Production Connections

OpenRabbit customers must never enter API keys, OAuth client IDs, client secrets, callback URLs, terminal commands, or developer-console settings.

## Customer experience

1. Sign in to OpenRabbit.
2. Open the dashboard.
3. Click **Connect Gmail**, **Connect Calendar**, **Connect CRM**, or another provider.
4. Sign in on the provider's normal authorization page.
5. Approve access.
6. Return to OpenRabbit.
7. OpenRabbit verifies the provider connection before changing the UI from **Ready to connect** to **Connected**.

Google Maps is a platform capability, not a customer connection. The map may work before MLS/listing data is connected; listing metrics must remain blank until an authoritative market-data provider is available.

## OpenRabbit-owned infrastructure

These values belong only in GitHub Actions / production infrastructure and must never be committed or shown to customers:

### Repository variables

- `HOSTINGER_VM_ID`
- `OPENRABBIT_GATEWAY_SITE` — Caddy site address, normally an HTTPS hostname such as `https://gateway.example.com`.
- `OPENRABBIT_CONNECTION_GATEWAY_URL` — public gateway base URL. Usually the same URL as `OPENRABBIT_GATEWAY_SITE`.
- `OPENRABBIT_GATEWAY_CORS_ORIGIN` — allowed web origin when browser access is enabled.

### Repository secrets

- `HOSTINGER_API_KEY`
- `OPENRABBIT_TOKEN_ENCRYPTION_KEY`
- `OPENRABBIT_GATEWAY_APP_TOKEN` — transitional server/session protection; do not embed in customer builds.
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `HUBSPOT_OAUTH_CLIENT_ID`
- `HUBSPOT_OAUTH_CLIENT_SECRET`
- `GOOGLE_MAPS_BROWSER_KEY`

## Public HTTPS gateway

The Hostinger deployment uses Caddy in front of the Node connection gateway. Caddy terminates HTTP/HTTPS traffic and proxies only to the internal `connection-gateway:8790` service. The gateway container itself is not published directly to the internet.

When `OPENRABBIT_GATEWAY_SITE` is an HTTPS hostname that resolves to the VPS, Caddy manages the certificate automatically. Ports 80 and 443 must be available on the VPS firewall.

The GitHub deployment workflow validates Docker Compose before deployment and then verifies `${OPENRABBIT_CONNECTION_GATEWAY_URL}/health` when the public URL variable is configured.

## Google OAuth owner setup

Create one OpenRabbit Google OAuth application. Configure the production callback exactly as:

`<OPENRABBIT_CONNECTION_GATEWAY_URL>/oauth/google/callback`

Enable the Gmail API and Google Calendar API. OpenRabbit currently requests read-only Gmail and Calendar scopes. Store the client ID and client secret only in GitHub repository secrets.

Users then click **Connect Gmail** or **Connect Calendar** and use Google's normal account chooser. No credentials are copied into OpenRabbit.

## HubSpot owner setup

Create the OpenRabbit HubSpot public app and configure its callback exactly as:

`<OPENRABBIT_CONNECTION_GATEWAY_URL>/oauth/hubspot/callback`

Store the app client ID and client secret only in GitHub repository secrets.

## Connection-state rule

A button click never makes a provider appear connected. OpenRabbit verifies the stored authorization against the provider API. If verification fails or authorization is revoked, the dashboard returns to **Ready to connect**.

## Deployment flow

Normal code changes follow:

`ChatGPT / developer change -> GitHub main -> GitHub Actions -> Hostinger VPS -> public health verification`

No recurring SSH or command-line work should be required for normal application releases.
