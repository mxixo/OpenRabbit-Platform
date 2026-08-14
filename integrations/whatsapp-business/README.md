# WhatsApp Business integration

Framework-independent WhatsApp Business Platform webhook ingestion for OpenRabbit Layer 5.

## Included in this increment

- Meta webhook verification challenge
- `X-Hub-Signature-256` validation before JSON parsing
- inbound message normalization
- org-scoped idempotency by WhatsApp message id
- deterministic urgency scoring with explainable reasons
- read-only recent-message review
- in-memory repository for tests
- PostgreSQL schema with tenant isolation policy

Run the integration test:

```bash
npm run test:whatsapp
```

## Production wiring still required

1. Deploy public HTTPS `GET` and `POST` routes that preserve the raw request body.
2. Store the Meta app secret and verification token in a secrets manager.
3. Implement the repository contract against PostgreSQL using `schema.sql`.
4. Subscribe the Meta app/WABA to the `messages` webhook field.
5. Register `reviewRecentMessages` as a read-only, org-scoped OpenRabbit tool.

The deployable Supabase Edge Function entrypoint is at
`supabase/functions/whatsapp-webhook/index.ts`. It intentionally requires
`META_VERIFY_TOKEN`, `META_APP_SECRET`, and `OPENRABBIT_ORG_ID` as private
function secrets. JWT verification must be disabled for this webhook because
Meta authenticates requests with the HMAC signature instead.

Never log message bodies, raw webhook payloads, app secrets, or access tokens. Sending remains a separate approval-controlled tool.
