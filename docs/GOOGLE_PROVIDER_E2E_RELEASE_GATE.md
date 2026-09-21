# Google provider E2E release gate

Status: production-readiness gate for issue #86.

Passing unit tests, OAuth contract tests, or mocked provider tests is not sufficient evidence that OpenRabbit's real connection lifecycle works in a hosted environment. This gate defines the minimum non-sensitive evidence required before the Google connection path can be called production-ready.

## Required live sequence

One clean hosted-account run must prove, in order:

1. **Hosted sign-in** — the user reaches the production-candidate environment through the real account/session boundary.
2. **Read-only authorization** — backend-authoritative Google scope evidence contains a supported read scope and contains no Gmail/Calendar write scope.
3. **Real provider read** — a Gmail or Calendar read succeeds against Google, not a fixture.
4. **Incremental write authorization** — only after an explicit governed write request, backend-authoritative scopes show the corresponding write permission while preserving the prior read grant.
5. **Governed write execution** — the write traverses the policy/action path, records an execution ID and allow decision, and Google reports success.
6. **Provider revoke/disconnect** — authority is actually revoked, not merely hidden in the client.
7. **Post-revoke denial** — a subsequent governed action is blocked because backend authority is gone.
8. **Reconnect recovery** — reconnect returns to read-only authority and another real provider read succeeds.

The validator is `integrations/google/provider-e2e-evidence.js` and the protocol identifier is `google_provider_e2e_v1`.

## Evidence hygiene

The artifact is deliberately metadata-only. Do not store access/refresh tokens, authorization codes, client secrets, passwords, email/message bodies, or customer content. Use opaque proof IDs, an irreversible account-subject hash, timestamps, backend state, authoritative scope names, execution IDs, capability names, policy result, provider result, and revoke/recovery state.

Each phase must have a unique proof ID and monotonic timestamp. The artifact must declare `environment: hosted_production_candidate` and `simulated: false`; mock/fixture evidence fails closed. The canonical SHA-256 returned by the validator may be persisted with the release record so later changes to the evidence are detectable.

## Release interpretation

A passing artifact certifies only this bounded Google connection lifecycle. It does not certify every provider, every workflow, or every failure/retry mode in OpenRabbit. It is intentionally stronger than a UI showing “Connected”: backend scope evidence, real provider operations, post-revoke denial, and reconnect recovery are all required.

Issue #86 should remain open until one live artifact validates successfully. If the hosted run exposes a failure, preserve the failed phase and fix the product rather than weakening or skipping the gate.
