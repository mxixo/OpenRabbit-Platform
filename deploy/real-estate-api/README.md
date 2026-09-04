# Real-estate API deployment

This container runs the first OpenRabbit commercial underwriting service. It
expects the schema in `integrations/supabase/real-estate-state/schema.sql` to
already exist.

## Required server configuration

- `OPENRABBIT_API_TOKEN` — random value of at least 32 bytes
- `OPENRABBIT_ACTOR_ID` — operator identity recorded in approvals and audit
- `OPENRABBIT_ORG_ID` — tenant available through this instance
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SECRET_KEY` — server-only secret key

Optional configuration:

- `OPENRABBIT_API_HOST` — defaults to `127.0.0.1`; use `0.0.0.0` in a container
- `OPENRABBIT_API_PORT` — defaults to `3000`
- `OPENRABBIT_ALLOWED_OUTREACH_RECIPIENTS` — comma-separated controlled test recipients

Generate a token with a cryptographically secure generator, for example
`openssl rand -hex 32`. Keep it in the host or container secret manager. Do not
commit it to Git, place it in an image, or expose it to frontend JavaScript.

## Local start

```bash
npm ci
npm run start:real-estate-api
```

The process fails at startup if required configuration is absent. `GET /health`
does not require authentication. All `/v1/orgs/:orgId/*` routes require
`Authorization: Bearer <token>` and must match the configured organization.

## Container build

```bash
docker build -f deploy/real-estate-api/Dockerfile -t openrabbit-real-estate-api .
```

Bind the container service behind a TLS reverse proxy or managed HTTPS edge.
Do not expose this initial service directly to the public internet without rate
limiting, request logging, and network controls.
