# Release Readiness Gate

OpenRabbit production has a separate fail-closed release/no-release decision boundary in `deploy/production/release-readiness.json`.

The manifest does not treat repository completeness as commercial readiness. A public `go` decision requires evidence for every required gate: the dedicated production account boundary, tenant isolation, Environment Blueprint migration, Action Receipt chain restore, provider lifecycle certification, rollback/restore rehearsal, the real-estate golden path, adversarial regression, privacy/retention review, counsel review of Terms/Privacy/AI disclosures, billing/support/escalation, monitoring/incident response and manual accessibility certification.

A gate cannot be marked passed without an evidence reference. A `go` decision is rejected while any gate remains blocked and also requires a named release candidate, attribution and timestamp. WayGo and Trading V1 are explicitly separate release boundaries so neither can inherit OpenRabbit Core readiness by implication.

The checked-in manifest intentionally remains `no-go` while the production Supabase boundary is undesignated and the external commercial evidence is incomplete. `npm run preflight:release-readiness` exits non-zero until a valid evidence-backed `go` packet exists. This makes the release decision auditable without pretending unresolved provider, legal, privacy, billing, support or recovery work is complete.
