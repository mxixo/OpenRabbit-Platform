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
- policy engine cannot be bypassed by worker/runtime
- provenance answers are deterministic from receipts
- revoke/reconnect/account-mismatch flows pass
- backup/restore and runtime restart drills pass
- production monitoring and incident path exist
- public claims match actually validated capabilities
