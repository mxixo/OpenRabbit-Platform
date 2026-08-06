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

## Commercial investment MVP workflow
The `commercial_investment_workflow` skill in `src/skills/commercial-investment-workflow.skill.js` provides the first usable end-to-end property screening workflow.

### Workflow scope
1. Accept a commercial property address.
2. Gather available property context from input and optional Camino enrichment.
3. Estimate key metrics (NOI, cap rate, DSCR, annual cash flow, cash-on-cash).
4. Generate investment summary and opportunity score.
5. Draft investor outreach and emit a structured report payload.

### Local run command
```bash
npm run workflow:commercial -- '{"address":"2500 Commerce Blvd, Dallas, TX","purchasePrice":1850000,"annualGrossIncome":255000,"occupancyRate":0.93,"operatingExpenseRatio":0.34,"downPaymentPct":0.3,"interestRatePct":6.4,"amortizationYears":25}'
```
If `CAMINO_API_KEY` is set, location context enrichment is included in `propertyInfo`.

### Run tests
```bash
npm test
```

## Product architecture direction

OpenRabbit is an **AI Operating Environment** (not a chatbot / single agent). See `docs/architecture/ai-operating-environment-vision.md` and the companion reset docs for Platform vs Runtime vs Workers vs Capabilities.

