# OpenRabbit Provider Owner Setup

This checklist is for the OpenRabbit product owner. Customers must never see or enter any of these credentials.

## Production account boundary first

Do not configure a hosted provider release against an implicit or guessed account project. OpenRabbit production now fails closed until an explicit Supabase Auth/account/data boundary is designated and configured.

Before live provider certification:

- designate the production Supabase project intentionally;
- configure its URL and publishable credential through the production environment only;
- keep service-role/server secrets out of Git and browser code;
- verify hosted sign-in and tenant/session isolation;
- then run provider certification from a clean OpenRabbit account.

WayGo is a separate product/backend and must not be reused as the OpenRabbit account boundary.

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

Store in GitHub Actions secrets:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

### Progressive authorization contract

Initial connection is deliberately read-only. The user should be able to connect and verify real data without granting write authority.

Initial Google authorization requests:

- Gmail read-only: `https://www.googleapis.com/auth/gmail.readonly`
- Calendar event read-only: `https://www.googleapis.com/auth/calendar.events.readonly`

Write authority is requested incrementally only when the user activates a governed write capability:

- Gmail send: `https://www.googleapis.com/auth/gmail.send`
- Calendar write: `https://www.googleapis.com/auth/calendar.events`

The OAuth flow uses incremental authorization (`include_granted_scopes=true`). A Connected account is therefore not synonymous with write authority; the backend must verify the provider-reported scopes needed for each write.

Public production use may require Google OAuth verification because these scopes access user data. Provider review must reflect the actual progressive scope set rather than describing the app as permanently read-only.

### Required production certification

Do not mark Google production-ready from mocked OAuth, local token presence, or a client-side Connected state. From one clean hosted account, capture the non-simulated `google_provider_e2e_v1` lifecycle:

1. hosted OpenRabbit sign-in;
2. backend-authoritative read-only Google connection;
3. real provider read;
4. explicit incremental Gmail/Calendar write authorization;
5. governed provider write;
6. provider-side revocation;
7. verified post-revoke denial;
8. read-only reconnect and successful provider read.

Run the repository Google provider E2E preflight against the resulting metadata-only artifact. Retain the canonical certification hash, but never persist OAuth tokens, auth codes, client secrets, passwords, or customer message/calendar content in release evidence.

## Microsoft 365 — Outlook + Calendar

Create an application registration for OpenRabbit in Microsoft Entra.

Redirect URI:

`https://openrabbit.93-188-163-198.sslip.io/oauth/microsoft/callback`

Store:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`

Repository variable (optional; defaults to multi-tenant/common):

- `MICROSOFT_TENANT=common`

Current delegated permissions:

- `User.Read`
- `Mail.Read`
- `Calendars.Read`
- `offline_access`
- basic OpenID profile/email scopes

This gives agents a normal Microsoft sign-in path for Outlook mail and Microsoft Calendar. If Gmail/Google Calendar are not connected, the live dashboard can use Microsoft mail/calendar data instead.

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

## Maps

OpenRabbit has a zero-configuration OpenStreetMap fallback with address/place search, so the customer map works without any customer key or account connection.

Google Maps remains an optional enhanced provider. If enabled, store a restricted browser key in:

- `GOOGLE_MAPS_BROWSER_KEY`

Restrict the key to the Maps JavaScript API and approved OpenRabbit origins. Maps are presented to users as a built-in platform capability rather than an account connection.

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
