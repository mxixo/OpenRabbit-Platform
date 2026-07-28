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
