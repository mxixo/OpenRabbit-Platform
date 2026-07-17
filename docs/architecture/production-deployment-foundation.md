# Production Deployment Foundation
## Purpose
Phase 9 establishes an initial production deployment configuration and environment-level IaC scaffold to support controlled rollout, validation, and rollback.
## Deployment configuration baseline
- `deploy/production/rollout-strategy.yaml` defines preflight, canary, full rollout, post-verify, and rollback thresholds.
- `deploy/production/services.yaml` defines service deployment order and minimum instance expectations.
## IaC baseline
- `infra/iac/environments/prod/main.tf` composes network, compute, and secrets module boundaries.
- `infra/iac/environments/prod/variables.tf` defines environment, region, release channel, and tagging inputs.
- `infra/iac/environments/prod/outputs.tf` exposes resolved deployment metadata.
- `infra/iac/environments/prod/terraform.tfvars.example` provides production configuration defaults.
## Operational intent
- Keep rollout policy explicit and reviewable in-repo.
- Use canary-first progression before full promotion.
- Preserve deterministic rollback triggers for latency, error, and availability regressions.
