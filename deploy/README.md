# Deploy
Release and environment deployment definitions and checklists.
## Phase 9 production deployment assets
- `deploy/production/rollout-strategy.yaml` defines rollout stages, canary policy, and rollback thresholds.
- `deploy/production/services.yaml` defines service deployment order and minimum production instance counts.
- `scripts/release/deploy-prod.sh` validates rollout configs and executes a production rollout simulation (`--dry-run` by default).
