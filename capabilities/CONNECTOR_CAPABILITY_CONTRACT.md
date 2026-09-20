# Connector Capability Contract

Every connector publishes a machine-readable capability manifest covering provider/version, operations, provider scopes, reversibility, default policy class, resource boundaries, idempotency, verification receipts, webhooks, provenance, credential handling, rate limits, and retry semantics.

The policy engine—not the connector or worker model—decides whether an operation may execute. Connectors receive only scoped credentials needed for the approved operation. A connector must never broaden its own scopes or silently substitute another user's connection.

## External-write invariants

Any capability declared as `write_external` must also declare and satisfy all of the following:

- `supports_idempotency: true` so retries cannot intentionally create a second external effect;
- `requires_target_verification: true` so authority is bound to the exact intended tenant/account/resource/domain/environment rather than inferred by the worker;
- `verification_receipt_required: true` so completion can be reconciled against provider evidence rather than model narration;
- `emits_telemetry: true` so policy coverage, latency, failures, blocks, and retries are observable.

The target verifier belongs to the trusted control plane. A worker-model assertion is not a valid target-verification source.

`capabilities/validate-registry.js` enforces the registry-wide invariants in CI, including capability/provider cross-references and tenant-scoped credential declarations.
