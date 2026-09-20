# Production & Commercial Readiness

## Four-day push priorities
1. Policy engine and action receipts.
2. Connector/capability contracts and tenant isolation.
3. Provenance/audit UX and observability.
4. OAuth/provider production readiness.
5. Deployment identity, error monitoring, traces, backups and recovery.
6. Commercial onboarding, billing/usage metering and support paths.
7. Counsel review of Terms, Privacy, AI automation disclosures and vertical-specific terms.
8. Security/adversarial test suite and release gates.

## Release gates
- no cross-tenant reads/writes
- secrets never projected to worker models
- external writes are idempotent and provider-verified
- retry does not duplicate external effects
- an uncertain provider outcome never becomes automatically retryable; it is persisted as reconciliation-required until provider/audit evidence resolves it
- completion-persistence failure after external side effects produces a durable reconciliation record when a reconciliation store is configured
- external target identity is bound to the intended tenant, connection, account, domain/resource, and operation rather than inferred from display names alone
- policy/credential/egress enforcement lives outside the worker's mutable decision context and cannot be disabled by a worker request
- policy engine cannot be bypassed by worker/runtime
- provenance answers are deterministic from receipts
- revoke/reconnect/account-mismatch flows pass
- backup/restore and runtime restart drills pass
- production monitoring and incident path exist
- public claims match actually validated capabilities
