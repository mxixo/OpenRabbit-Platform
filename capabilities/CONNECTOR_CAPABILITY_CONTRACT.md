# Connector Capability Contract

Every connector publishes a machine-readable capability manifest covering provider/version, operations, provider scopes, reversibility, default policy class, resource boundaries, idempotency, verification receipts, webhooks, provenance, credential handling, rate limits, and retry semantics.

The policy engine—not the connector or worker model—decides whether an operation may execute. Connectors receive only scoped credentials needed for the approved operation. A connector must never broaden its own scopes or silently substitute another user's connection.
