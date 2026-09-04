# OpenRabbit Platform
Production foundation workspace for OpenRabbit platform services, domains, and operations.

## Try OpenRabbit on your computer

OpenRabbit is designed so a tester can clone the public repository and run the base workspace without receiving the owner's private credentials.

Requirements: Git, Node.js 20+, npm, and a graphical desktop session for Electron.

```bash
git clone https://github.com/mxixo/OpenRabbit-Platform.git
cd OpenRabbit-Platform
npm run bootstrap:local
npm run verify:shareable
npm run desktop:start
```

`bootstrap:local` installs the root and desktop dependencies and creates a local `.env` from `.env.example` only if one does not already exist. It does not add secrets. Optional live integrations require the tester's own credentials.

For a full onboarding walkthrough, installer-building instructions, optional integrations, and troubleshooting, see [`docs/QUICKSTART.md`](docs/QUICKSTART.md).

## Developer validation commands
- `npm run ci:quick`
  - Runs `scripts/bootstrap/check-env.sh`.
  - Validates local baseline tooling availability (`git`, `node`, `npm`, `bash`).
  - Use before starting work or when onboarding a new environment.
- `npm run ci:quality-gates`
  - Runs `scripts/ci/run-quality-gates.sh` (canonical full CI validation path).
  - Validates install + lint + test + typecheck across all active TypeScript packages.
  - Use before opening or updating a pull request, and for final local verification.
- `npm run verify:shareable`
  - Runs a cross-platform smoke check for a freshly bootstrapped clone.
  - Verifies required workspace/desktop files, desktop dependencies, packaging targets, and the desktop shell test.

## OpenRabbit Desktop
The desktop distribution shell lives in `clients/desktop-shell` and wraps the current workspace client as an installable application.

### Local desktop run
```bash
npm run desktop:install
npm run desktop:start
```

### Local installer build
```bash
npm run desktop:dist
```

GitHub Actions can build macOS DMG, Windows NSIS, and Linux AppImage packages using `.github/workflows/desktop-build.yml`. Manual workflow runs retain installers as Actions artifacts; published GitHub Releases receive the installers as release assets.

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

## Product documentation (source of truth)

OpenRabbit is an **AI Operating Environment** (not a chatbot / single agent).

**Start here:** [`OPENRABBIT_CONTEXT.md`](OPENRABBIT_CONTEXT.md)

Canonical docs:

- [`docs/VISION.md`](docs/VISION.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md)
- [`docs/RUNTIMES.md`](docs/RUNTIMES.md)
- [`docs/AI_WORKERS.md`](docs/AI_WORKERS.md)
- [`docs/INDUSTRY_PACKS.md`](docs/INDUSTRY_PACKS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)

AI tools (Warp, OpenClaw, Antigravity, ChatGPT, etc.) must read these before proposing architectural changes.
