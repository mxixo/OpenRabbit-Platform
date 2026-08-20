# OpenRabbit Provider Owner Setup

This checklist is for the OpenRabbit product owner. Customers must never see or enter any of these credentials.

## Production gateway

Current bootstrap gateway base URL:

`https://openrabbit.93-188-163-198.sslip.io`

Use the same base URL in every provider application until a permanent OpenRabbit-owned hostname replaces it.

## Google — Gmail + Calendar

Create one Google OAuth web application owned by OpenRabbit.

Authorized redirect URI:

`https://openrabbit.93-188-163-198.sslip.io/oauth/google/callback`

Enable:

- Gmail API
- Google Calendar API
- Maps JavaScript API

Store in GitHub Actions secrets:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_MAPS_BROWSER_KEY`

OpenRabbit currently requests read-only Gmail and Calendar access. Public production use may require Google OAuth verification because these scopes access user data.

## HubSpot CRM

Create an OpenRabbit HubSpot public app.

Redirect URI:

`https://openrabbit.93-188-163-198.sslip.io/oauth/hubspot/callback`

Store:

- `HUBSPOT_OAUTH_CLIENT_ID`
- `HUBSPOT_OAUTH_CLIENT_SECRET`

Current read scopes:

- `crm.objects.contacts.read`
- `crm.objects.companies.read`
- `crm.objects.deals.read`

## Meta — Instagram + Facebook

Create an OpenRabbit Meta app with Facebook Login / Instagram Graph capabilities appropriate for professional accounts.

Redirect URI:

`https://openrabbit.93-188-163-198.sslip.io/oauth/meta/callback`

Store:

- `META_APP_ID`
- `META_APP_SECRET`

Optional repository variable:

- `META_GRAPH_VERSION`

The current product requests Page discovery/read access plus Instagram business profile/media access. Meta App Review may be required before broad production use.

## LinkedIn

Create an OpenRabbit LinkedIn developer application.

Redirect URI:

`https://openrabbit.93-188-163-198.sslip.io/oauth/linkedin/callback`

Store:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`

Baseline scopes are `openid profile email`. Additional posting/organization permissions should only be requested when the product workflow needs them and after LinkedIn approves the relevant product access.

## TikTok

Create an OpenRabbit TikTok for Developers application.

Redirect URI:

`https://openrabbit.93-188-163-198.sslip.io/oauth/tiktok/callback`

Store:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`

Baseline scopes are `user.info.basic,video.list`.

## Customer-facing rule

The finished customer flow is always:

`OpenRabbit account -> Ready to connect -> Connect provider -> provider's normal sign-in -> approve -> return to OpenRabbit -> provider verified -> real data appears`

No customer API keys. No customer OAuth client IDs. No customer callback URLs. No command-line setup.
