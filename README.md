# OpenRabbit Skills Scaffold
This repository now includes a custom skill framework for `openclaw` with four starter skills:
- `browser_session`
- `social_post_publish`
- `post_compliance_guard`
- `commercial_investment_workflow`

## Structure
- `src/skills/index.js`: skill registry + runner
- `src/skills/browser-session.skill.js`: browser automation entry point (dry-run by default; optional Playwright live mode)
- `src/skills/social-post-publish.skill.js`: social publish flow with platform token checks
- `src/skills/post-compliance-guard.skill.js`: post compliance and disclosure checks
- `src/skills/commercial-investment-workflow.skill.js`: address-to-investment-report workflow for commercial deal screening
- `src/skills/utils/*`: validation and secret helpers

## Install
```bash
npm install
```

Optional for real browser automation:
```bash
npm i playwright
```

## Configure secrets
1. Copy `.env.example` to `.env`.
2. Set only the tokens you need for target platforms.
3. Keep secrets out of source control.

## Run
```bash
npm start
```

Run the first commercial workflow (JSON input with address required):
```bash
npm run workflow:commercial -- '{"address":"100 Market St, Phoenix, AZ","purchasePrice":1200000,"annualGrossIncome":165000}'
```
If `CAMINO_API_KEY` is set, the workflow will also attach location context data to `propertyInfo`.

## Commercial investment MVP workflow
The `commercial_investment_workflow` skill is the first usable OpenRabbit workflow for screening a commercial property opportunity.

### What it does
1. Accepts a commercial property address.
2. Gathers available property context from payload inputs (and optional Camino location context when configured).
3. Estimates key investment metrics.
4. Generates an investment summary.
5. Scores the opportunity (`strong`, `watch`, or `weak`).
6. Drafts investor outreach.
7. Produces a structured report object.

### Run from CLI
```bash
npm run workflow:commercial -- '{"address":"2500 Commerce Blvd, Dallas, TX","purchasePrice":1850000,"annualGrossIncome":255000,"occupancyRate":0.93,"operatingExpenseRatio":0.34,"downPaymentPct":0.3,"interestRatePct":6.4,"amortizationYears":25,"units":12,"squareFeet":18000,"yearBuilt":2008}'
```

### Required input
- `address` (string)

### Optional investment assumptions
- `purchasePrice`
- `annualGrossIncome`
- `occupancyRate`
- `operatingExpenseRatio`
- `downPaymentPct`
- `interestRatePct`
- `amortizationYears`
- `units`
- `squareFeet`
- `yearBuilt`
- `notes`
- `locationRadiusMeters`

### Output fields
- `propertyInfo`
- `investmentMetrics`:
  - `effectiveGrossIncome`
  - `operatingExpenses`
  - `noi`
  - `annualDebtService`
  - `annualCashFlowBeforeTax`
  - `capRate`
  - `cashOnCash`
  - `dscr`
- `investmentSummary`
- `opportunityScore`
- `investorOutreachDraft`
- `report` (structured full payload + results)

### Validation behavior
- Missing `address` returns:
  - `ok: false`
  - `error: "input.address must be a non-empty string"`


## Test
```bash
npm test
```

## Live Integration Preflight
Run read-only readiness checks for HubSpot, Google Calendar, and DocuSign:
```bash
npm run preflight:live
```

Useful flags:
```bash
# Skip provider network calls and check env/defaults only
npm run preflight:live -- --no-network

# Fail command when any provider check fails
npm run preflight:live -- --strict

# Check only selected providers
npm run preflight:live -- --providers=hubspot,docusign
```

## Example Invocation
Use from Node:
```js
const { createOpenClawSkillRunner } = require("./src/skills");

const runner = createOpenClawSkillRunner({ actor: "openclaw" });

async function run() {
  const compliance = await runner.run("post_compliance_guard", {
    postId: "listing-123",
    content: "Beautiful new listing. Equal Housing Opportunity.",
  });

  if (!compliance.approved) return;

  await runner.run("social_post_publish", {
    postId: "listing-123",
    platform: "facebook",
    content: "Beautiful new listing. Equal Housing Opportunity.",
    mode: "dry_run",
  });
}

run();
```
