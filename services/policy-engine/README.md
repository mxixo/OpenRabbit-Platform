# OpenRabbit Policy Engine

Runtime implementation target for the autonomy doctrine.

Principle: **maximum useful autonomy within explicit boundaries, minimum unnecessary interruption, complete observability.**

The policy engine is separate from the worker model. It classifies proposed external actions as GREEN, YELLOW, RED, or BLOCK using durable delegated authority, capability scopes, and hard platform boundaries.

## Target Scope Guard

Permission to perform an action is not permission to act on an arbitrary target. Every external side effect must carry a target binding verified by a trusted control-plane component such as the connector gateway, browser guard, broker adapter, or platform runtime.

The executable guard in `runtime.js` fails closed when the target is missing, ambiguous, verified only by the worker model, cross-tenant, or mismatched on a required dimension. Typical dimensions are organization, connection/account, resource, domain, and environment.

The worker/agent must not be able to modify the policy engine, credential broker, target verifier, audit sink, or network egress controls that govern it. Those controls belong outside the worker trust boundary.

## Classification

- **GREEN** — routine work under standing authority and an exact trusted target binding.
- **YELLOW** — unusual but authorized work; seamless mode can continue while surfacing the action.
- **RED** — consequential action or request for new authority; confirmation is required.
- **BLOCK** — scope, target, tenant, secret, audit, or other hard-boundary violation. Confirmation cannot override a BLOCK decision.

`tests/policy-engine.test.js` regression-tests target mismatch, missing/untrusted verification, ambiguity, cross-tenant access, audit bypass, permission expansion, autonomy profiles, and safe read-only/internal operations.

## Observability contract

Every action receipt records whether the requested operation can create an external side effect. `metrics.js` summarizes the receipt stream into control-plane service levels and latency diagnostics.

Production targets are deliberately coverage-based rather than prompt-count based:

- **100% policy coverage** — every recorded action has a deterministic policy decision before execution.
- **100% target-verification coverage for external effects** — every external side-effect proposal is checked against a trusted target verifier, including proposals correctly blocked because the target does not match.
- **100% provider-verification coverage after an external execution attempt** — executed/failed external attempts must resolve to provider evidence or remain visibly unreconciled.

The dashboard may also track GREEN/YELLOW/RED/BLOCK counts, block rate, confirmation rate, failure rate, target-match rate, and p50/p95 execution and verification latency. These are diagnostic metrics, not incentives to minimize blocks or confirmations. A rising block rate may indicate attacks, broken connectors, or policy drift and should be investigated rather than suppressed.

`targetVerificationCoverage` measures whether the check happened; `targetMatchRate` measures whether the observed destination actually matched the intended destination. A correctly detected mismatch therefore preserves 100% verification coverage while lowering the match rate.

`tests/policy-observability.test.js` verifies complete coverage, missing policy/target evidence, provider reconciliation gaps, blocked-target semantics, internal non-side-effecting work, and invalid latency timestamps.
