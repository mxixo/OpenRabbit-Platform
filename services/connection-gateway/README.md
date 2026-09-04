# OpenRabbit Connection Gateway

OpenRabbit's production connection layer keeps provider app secrets and customer refresh tokens off the desktop application.

## Goal

The shipped desktop experience should be:

1. User clicks **Connect**.
2. OpenRabbit opens the provider sign-in/consent page.
3. The provider redirects to this gateway.
4. The gateway exchanges the authorization code using OpenRabbit's confidential app credentials.
5. Tokens are stored server-side, encrypted at rest and scoped to the authenticated OpenRabbit user/organization.
6. The gateway redirects back to the desktop through an `openrabbit://` deep link.
7. The desktop displays **Connected**. Users never paste API keys, client secrets, or tokens.

## Boundary

The desktop may know:

- the public Connection Gateway URL;
- provider names and connection state;
- a short-lived connection attempt ID;
- non-secret account metadata returned by the gateway.

The desktop must not contain:

- Google, HubSpot, Microsoft, Meta, LinkedIn, or other provider client secrets;
- provider refresh tokens;
- central OpenAI/API credentials intended for the hosted product;
- encryption keys for the connection vault.

## Initial API

- `GET /health` — readiness check.
- `GET /v1/providers` — public provider catalog and availability.
- `POST /v1/connections/:provider/start` — authenticated endpoint that creates a connection attempt and returns an authorization URL.
- `GET /oauth/:provider/callback` — provider callback handled by the server.
- `GET /v1/connections/:provider/status` — authenticated status query.
- `DELETE /v1/connections/:provider` — disconnect/revoke connection.

The first implementation deliberately exposes only `/health` and `/v1/providers`. OAuth start/callback/status routes should not be considered production-ready until OpenRabbit user authentication and durable encrypted token storage are connected.

## VPS deployment

The gateway is designed to run behind HTTPS on the OpenRabbit VPS, for example:

`https://connect.openrabbit.ai`

Recommended production components:

- reverse proxy / TLS termination (Caddy or nginx);
- this Node service bound only to localhost/private Docker network;
- PostgreSQL/Supabase for connection metadata;
- encrypted token storage (application envelope encryption or managed secret/key service);
- OpenRabbit account JWT validation;
- provider credentials injected as server environment secrets;
- audit logging and token refresh jobs.

## Local development

```bash
OPENRABBIT_CONNECTION_GATEWAY_PORT=8790 node services/connection-gateway/server.js
```

Then open `http://127.0.0.1:8790/health`.
