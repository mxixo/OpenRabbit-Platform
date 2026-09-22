# Production & Commercial Readiness

OpenRabbit should advance through explicit release states rather than treating a successful build or a reachable hosted UI as proof of production readiness. Every release state below is fail-closed: if a required gate is unknown, stale, simulated, or contradicted by provider evidence, the product remains at the prior state.

## Four-day push priorities
1. Policy engine and action receipts.
2. Connector/capability contracts and tenant isolation.
3. Provenance/audit UX and observability.
4. OAuth/provider production readiness.
5. Deployment identity, error monitoring, traces, backups and recovery.
6. Commercial onboarding, billing/usage metering and support paths.
7. Counsel review of Terms, Privacy, AI automation disclosures and vertical-specific terms.
8. Security/adversarial test suite and release gates.

## Current release-state ledger — 2026-09-22

### Internal alpha — allowed now
Purpose: engineering and owner testing with non-production or explicitly isolated accounts.

Required:
- repository quality suite passes;
- consequential writes remain policy-gated and auditable;
- customer secrets are never committed to Git or projected into worker prompts;
- simulated/demo data is visibly labeled and cannot be presented as provider-authoritative data;
- failures remain truthful rather than being converted into synthetic success states.

Current implementation evidence:
- the runtime now has a typed fail-closed Guardian policy contract and versioned Action Receipt/provenance contract, including capability, command-origin, provider-authorization and strong-identity checks for high-risk actions (PR #120);
- the reference Action Receipt store is append-only, tenant-isolated in memory and defensively copied, with provider-confirmation evidence checks (PR #120);
- connector operations now have a typed fail-closed capability contract outside the worker's mutable context, binding provider operation, risk, required capability, allowed execution mode, minimum context scope, credential mode, provider policy, account binding, idempotency and provider confirmation (PR #123);
- adversarial connector regressions now cover context-scope expansion, account substitution, undeclared API-to-browser fallback, unknown provider authority and replay-prone writes; tool authority and personal-context authority remain separate permissions (PR #123);
- the authenticated Connections surface reports provider-authoritative connection/verification/reconnect state rather than inferring authority from button clicks (PRs #114-115).

Current status: **eligible for continued internal alpha work**. The Guardian/receipt/connector-contract work is a reference runtime control, not evidence of production durability or hosted enforcement. This status does not authorize production customer data or a paid public launch.

### Closed beta — blocked
Purpose: a small invited group using real accounts and provider data with constrained support expectations.

Hard gates:
- [ ] Explicit production OpenRabbit Auth/account/data boundary is designated and validated — issue #90.
- [ ] Production-like sign-in plus tenant/session isolation smoke test passes against that boundary.
- [ ] At least one complete real provider lifecycle is certified from a clean hosted account; Google is the reference path — issue #86.
- [ ] Provider-owner credentials, redirects, APIs and app-review requirements are completed for every provider advertised as available — issue #77.
- [ ] Action receipts and reconciliation-required records are persisted in a durable production store with tenant isolation, restart/recovery evidence, immutable/append-only semantics, and a tested path for reconciling uncertain external effects; the current in-memory reference store is not sufficient.
- [ ] Production connector/credential paths demonstrably enforce the declared capability contract rather than only exposing a reference evaluator in runtime-core.
- [ ] Backup/restore, runtime restart, reconciliation and incident-response paths have evidence rather than only design intent.
- [ ] Customer-facing capability claims are limited to provider paths that actually passed production certification.

Current blocker: the connected Supabase organization exposes the historical OpenRabbit candidate `djplmhglilcwqfotnjew` as **INACTIVE** and the separate WayGo project `zwrsapkgdfsvvaoefhqf` as **ACTIVE_HEALTHY**. No third OpenRabbit production account project is currently visible. The product owner must deliberately designate the existing inactive project or a replacement before production identity work continues.

### Paid beta — blocked behind closed beta
Purpose: charge a limited cohort while maintaining explicit beta scope and elevated support/rollback controls.

Additional gates:
- [ ] Closed-beta gates remain green for a sustained production-like test interval.
- [ ] Billing/usage metering has idempotent entitlement and cancellation behavior.
- [ ] Terms, Privacy, AI automation disclosures and vertical-specific claims have owner/counsel review.
- [ ] Support, escalation, incident ownership and customer-data deletion/export procedures are documented and tested.
- [ ] Adaptive onboarding reaches a useful personalized preview without forcing private-provider connection, and simulated preview data remains unmistakable — issue #83.
- [ ] Product telemetry can distinguish provider outage, auth/revocation, policy denial, user cancellation, reconciliation-required, and internal failure states.
- [ ] Receipt/provenance UX can answer who/what initiated a consequential action, what policy/capability authorized it, which provider/account was targeted, and whether the external effect was confirmed, uncertain, failed, or reconciled without exposing secrets/customer content.

### General availability — blocked behind paid beta
Purpose: broadly market OpenRabbit as a production service.

Additional gates:
- [ ] Restore and disaster-recovery drill passes from documented backups.
- [ ] Security/adversarial suite covers cross-tenant access, prompt/tool authority escalation, replay/idempotency, account substitution, stale authorization, receipt/provenance tampering, context-scope escalation and secret exfiltration paths.
- [ ] Public status/incident path and measurable service objectives exist.
- [ ] Provider revocation/reconnect behavior is periodically recertified, not assumed permanent after one successful test.
- [ ] Commercial claims, screenshots and pricing pages describe only generally available capabilities and clearly distinguish beta/preview features.

## Non-negotiable release gates
- no cross-tenant reads/writes
- secrets never projected to worker models
- external writes are idempotent and provider-verified
- retry does not duplicate external effects
- an uncertain provider outcome never becomes automatically retryable; it is persisted as reconciliation-required until provider/audit evidence resolves it
- completion-persistence failure after external side effects produces a durable reconciliation record when a reconciliation store is configured
- external target identity is bound to the intended tenant, connection, account, domain/resource, and operation rather than inferred from display names alone
- connector execution mode and context scope cannot silently widen beyond the pre-execution capability contract
- policy/credential/egress enforcement lives outside the worker's mutable decision context and cannot be disabled by a worker request
- policy engine cannot be bypassed by worker/runtime
- action receipts are append-only, tenant-scoped and durable across runtime restarts before production customer actions are allowed
- provenance answers are deterministic from receipts
- revoke/reconnect/account-mismatch flows pass
- backup/restore and runtime restart drills pass
- production monitoring and incident path exist
- public claims match actually validated capabilities

## Product-boundary rule

WayGo is a separate product boundary. A healthy WayGo Supabase project is evidence about WayGo only; it must never be used as a substitute for OpenRabbit production Auth/account certification. Likewise, the WayGo front end should remain source-recovery blocked until the authoritative Hostinger baseline is recovered and imported into its own repository (issue #95).

Portable source-independent contracts now cover `waygo_rank_v1`, conservative total-trip-cost semantics, normalized provider evidence, and `waygo_itinerary_v1` feasibility/revision behavior (PRs #121 and #124). Executable acceptance vectors enforce hard-budget veto, unresolved material costs, evidence downgrade, deterministic GO/MAYBE/SKIP ranking, itinerary overlap/transfer constraints, uncertain-opening-hours review states, no secret projection into provider evidence, and a planning-only/no-autonomous-purchase boundary. This advances product logic but does **not** satisfy source recovery, owner-scoped itinerary persistence, live provider pricing, provider commercial rights, booking execution, or dedicated-repository gates.

## Release-decision rule

A gate can move from blocked to passed only when its evidence is reproducible and points to the exact production boundary/provider/runtime being released. Unit tests, route availability, synthetic fixtures, an in-memory reference store, or a healthy unrelated backend are supporting evidence, not substitutes for production certification.
