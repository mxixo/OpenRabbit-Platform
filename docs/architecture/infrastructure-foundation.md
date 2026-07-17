# Infrastructure Foundation
## Purpose
Phase 1 establishes baseline infrastructure controls required for safe, repeatable platform evolution.

## Baseline components
- Environment definitions in `infra/environments/` and `deploy/environments/`
- Deployment baseline policy in `infra/deployments/baseline.yaml`
- Secrets handling policy in `infra/secrets-policy.yaml`
- IaC module boundary contracts in `infra/iac/modules/`
- CI quality gates in `.github/workflows/ci.yml`
- Automation scripts in `scripts/bootstrap`, `scripts/ci`, and `scripts/release`

## Security and reliability posture
- Secrets are policy-bound to managed stores and explicit rotation intervals.
- Promotion gates enforce staged progression from `dev` to `staging` to `prod`.
- CI executes deterministic quality checks before merge/deploy decisions.
- Deployment baseline includes health-check and rollback defaults.

## Operational model
- Engineers validate local prerequisites with `scripts/bootstrap/check-env.sh`.
- CI runs `scripts/ci/run-quality-gates.sh` for shared quality enforcement.
- Release owners validate promotion path with `scripts/release/promote.sh` and checklist evidence.
