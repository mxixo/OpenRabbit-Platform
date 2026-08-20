# OpenRabbit Production Connections

OpenRabbit customers must never enter API keys, OAuth client IDs, client secrets, callback URLs, terminal commands, or developer-console settings.

## Customer experience

1. Create an OpenRabbit account or sign in.
2. Open the dashboard.
3. Click **Connect Gmail**, **Connect Calendar**, **Connect CRM**, or another provider.
4. Sign in on the provider's normal authorization page.
5. Approve access.
6. Return to OpenRabbit.
7. OpenRabbit verifies the provider connection before changing the UI from **Ready to connect** to **Connected**.

Google Maps is a platform capability, not a customer connection. The map may work before MLS/listing data is connected; listing metrics must remain blank until an authoritative market-data provider is available.

## OpenRabbit account identity

The desktop app uses OpenRabbit account authentication backed by Supabase Auth. The project URL and publishable key are public client configuration; no Supabase secret/service key is embedded in the desktop app.

Desktop sessions are persisted locally with Electron `safeStorage` when the operating system provides secure storage. The signed-in account session is sent to the Connection Gateway, which validates it against the account provider before using the account's stable user ID as the namespace for Gmail, Calendar, CRM, and other connection records.

A client-supplied `x-openrabbit-user` value alone is not sufficient to impersonate a customer account. The gateway derives the customer identity from the validated account session. A separate service token remains available only for trusted internal tooling during the transition.

## OpenRabbit-owned infrastructure

### Repository variables

- `HOSTINGER_VM_ID`
- `OPENRABBIT_GATEWAY_SITE` — Caddy site address, normally an HTTPS hostname.
- `OPENRABBIT_CONNECTION_GATEWAY_URL` — public gateway base URL. Usually the same URL as `OPENRABBIT_GATEWAY_SITE`.
- `OPENRABBIT_GATEWAY_CORS_ORIGIN` — allowed web origin when browser access is enabled.

The current bootstrap build can use `https://openrabbit.93-188-163-198.sslip.io` while the product is being wired. This is a temporary testing hostname, not the intended permanent OpenRabbit production domain.

### Repository secrets

- `HOSTINGER_API_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `HUBSPOT_OAUTH_CLIENT_ID`
- `HUBSPOT_OAUTH_CLIENT_SECRET`
- `GOOGLE_MAPS_BROWSER_KEY`

Optional infrastructure secrets:

- `OPENRABBIT_TOKEN_ENCRYPTION_KEY` — if omitted, the gateway generates a strong key once and persists it in the protected gateway data volume.
- `OPENRABBIT_GATEWAY_APP_TOKEN` — transitional trusted-service credential; do not embed it in customer builds.

## Public HTTPS gateway

The Hostinger deployment uses Caddy in front of the Node connection gateway. Caddy terminates HTTP/HTTPS traffic and proxies only to the internal `connection-gateway:8790` service. The gateway container itself is not published directly to the internet.

When `OPENRABBIT_GATEWAY_SITE` is an HTTPS hostname that resolves to the VPS, Caddy manages the certificate automatically. Ports 80 and 443 must be available on the VPS firewall.

The GitHub deployment workflow validates Docker Compose before deployment and verifies the public `/health` endpoint after deployment.

## Google OAuth owner setup

Create one OpenRabbit Google OAuth application. Configure the production callback exactly as:

`<OPENRABBIT_CONNECTION_GATEWAY_URL>/oauth/google/callback`

Enable the Gmail API and Google Calendar API. OpenRabbit currently requests read-only Gmail and Calendar scopes. Store the client ID and client secret only in GitHub repository secrets.

Users then click **Connect Gmail** or **Connect Calendar** and use Google's normal account chooser. No credentials are copied into OpenRabbit.

Before broad distribution, replace the temporary bootstrap hostname with an OpenRabbit-owned domain and complete Google's app/consent-screen verification requirements for the requested scopes.

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
