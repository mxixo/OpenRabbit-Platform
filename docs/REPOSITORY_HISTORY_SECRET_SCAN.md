# Repository history secret-scan gate

OpenRabbit commercial release remains fail-closed until repository-history credential exposure is scanned, reviewed, and any real credential is rotated/remediated. Scanning the current working tree alone is insufficient because a credential deleted by a later commit can remain recoverable from Git history.

## Automated evidence

`npm run security:history-scan` runs `openrabbit_repository_history_secret_scan_v1` against reachable Git object history with unique blob inspection. By default it scans `git rev-list --objects --all`; `--rev <commit-or-ref>` scopes the same detector to objects reachable from one revision. The scanner refuses shallow history.

The dedicated GitHub Actions workflow checks out with `fetch-depth: 0` and uses two distinct controls:

- **Pull requests and pushes to `main`:** the same scanner version evaluates the base revision and head revision. CI fails only when a credential-like finding becomes newly reachable from the head history. This prevents unresolved legacy findings from growing and catches credentials that are added and then deleted within the same change because their blobs remain reachable from the new commits.
- **Manual full audit:** the workflow scans the full selected head and fails while any finding remains. Commercial release therefore still requires a zero-finding reviewed history; the comparison ratchet is not a waiver for legacy findings.

Comparison fingerprints are computed only inside the runner from rule ID, blob identity, line and variable metadata. Detailed reports are deleted before artifact upload. Retained artifacts and job summaries expose only aggregate counts and rule categories, not secret values, historical paths, blob IDs or line numbers.

The trusted-local report records the repository HEAD, requested history revision, resolved revision OID, scanner SHA-256, scan scope, blob counts, skipped binary/oversize counts, finding categories, historical paths, line numbers and blob object IDs. **Secret values are never copied into the report or console output.**

## Current detection scope

The V1 detector looks for high-confidence credential families such as private-key headers, AWS access-key IDs, GitHub tokens, OpenAI keys, Google OAuth client secrets, Stripe live secrets, Slack tokens, and generic long values assigned to variables whose names indicate secrets/tokens/passwords/API keys/service-role keys. Obvious placeholders and environment-variable references are suppressed.

V1 intentionally does not claim perfect secret detection. It is a release-control layer, not a substitute for provider-side credential inventory and rotation. A clean full audit means no configured V1 finding was detected in scanned textual blobs up to the frozen size limit; it does not prove that no secret of any possible format ever existed.

## Finding response

A full-history finding is a commercial-release blocker until reviewed. If it is a real credential:

1. revoke/rotate the credential at the provider first;
2. identify all environments and systems that used it;
3. replace runtime configuration through the intended secret store;
4. remove the credential from reachable Git history when appropriate, understanding that history rewriting changes commit identities and requires coordinated repository cleanup;
5. rerun the full-history scan and retain the clean evidence artifact;
6. separately verify current provider credentials and production configuration.

If a finding is a false positive, document the classification with the rule, path/blob, rationale, reviewer and timestamp. Do not weaken a detector merely to make a release gate green unless the changed rule remains defensible across the full repository.

## Release-readiness relationship

The comparison-mode CI guard answers a narrow question: **did this change make any new configured secret finding reachable from repository history?** A passing comparison does not mean the repository's historical secret debt is resolved.

`deploy/production/release-readiness.json` therefore keeps `repository_history_secret_scan_verified` false until the full reachable history is clean under the reviewed detector and the resulting evidence has been deliberately attached to the release decision. Repository visibility/license/IP review remains a separate owner/commercial decision.
