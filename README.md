# OpenRabbit Platform
Production foundation workspace for OpenRabbit platform services, domains, and operations.
## Developer validation commands
- `npm run ci:quick`
  - Runs `scripts/bootstrap/check-env.sh`.
  - Validates local baseline tooling availability (`git`, `node`, `npm`, `bash`).
  - Use before starting work or when onboarding a new environment.
- `npm run ci:quality-gates`
  - Runs `scripts/ci/run-quality-gates.sh` (canonical full CI validation path).
  - Validates install + lint + test + typecheck across all active TypeScript packages.
  - Use before opening or updating a pull request, and for final local verification.
