# Git Workflow
## Branch model
### `main`
- Production-only branch.
- Always releasable and protected.
- Updated only by fast-forward/merge from validated `release/*` or `hotfix/*` branches.

### `develop`
- Primary integration branch for upcoming releases.
- Default base for all new implementation work.
- Must stay buildable and testable.

### `feature/*`
- Short-lived branches created from `develop`.
- Naming format: `feature/<scope>-<short-description>`.
- Merged back into `develop` after review and passing CI.

### `release/*`
- Stabilization branches created from `develop` when preparing a release.
- Naming format: `release/v<major>.<minor>.<patch>`.
- Used for release-only fixes, docs updates, and version metadata updates.
- Merged into both `main` (for release) and `develop` (to keep parity).

### `hotfix/*`
- Emergency branches created from `main` for production incidents.
- Naming format: `hotfix/v<major>.<minor>.<patch>`.
- Merged into both `main` and `develop` after validation.

## Semantic versioning
The repository uses Semantic Versioning (`MAJOR.MINOR.PATCH`):
- `MAJOR`: breaking API/contract changes.
- `MINOR`: backward-compatible feature additions.
- `PATCH`: backward-compatible fixes and internal hardening.

Release tags should be annotated and match the release branch/version (example: `v1.4.2`).

## Commit conventions
Use Conventional Commits:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` non-behavioral code restructuring
- `docs:` documentation-only change
- `test:` test additions/changes
- `chore:` maintenance, tooling, dependency updates
- `ci:` CI/CD pipeline changes

Recommended format:
`type(scope): concise summary`

Example:
`feat(memory): add tenant-aware vector index routing`

For breaking changes, append `!` and include a `BREAKING CHANGE:` footer.
