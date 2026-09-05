# Reliability Pilot: Browser and Hostinger Continuity

**Date:** 2026-09-05  
**Source:** Oro Cash Offers and Maico Realty website migration pilot

## Observed failures

1. A Playwright Chromium cache appeared installed but lacked its required macOS framework.
2. The browser tool had no complete-bundle health probe or automatic local fallback.
3. A forced browser repair downloaded successfully but hung during finalization.
4. Hostinger was registered through two competing connections: one authenticated local connector and one unauthenticated remote connector.
5. The local Hostinger package cache lived inside a dated task directory.
6. Hostinger categories used floating package versions, which could change behavior between restarts.
7. Tool-count limits forced inactive Hostinger product groups to remain disabled.

## Local environment remediation

- Repaired and validated the complete Playwright Chromium bundle.
- Added browser-runtime health reporting and a truthful system-browser fallback.
- Disabled the duplicate unauthenticated Hostinger connection.
- Moved the Hostinger dependency cache to a permanent machine-level project location.
- Pinned every Hostinger product-group connector to the same known-good version.
- Registered the newer Hostinger mail and Horizons product groups in a disabled state so they are known to the environment without expanding the active tool surface.
- Confirmed that Hostinger OAuth credentials include a refresh token and that an authenticated read succeeds without a browser prompt.

## Platform requirements

OpenRabbit should implement these behaviors behind stable runtime and integration interfaces:

1. **Normalized health:** report process, dependency, authentication, and degraded-capability status separately.
2. **Bounded recovery:** apply startup and repair deadlines, progress watchdogs, and deterministic retry limits.
3. **Audited fallback:** select an equivalent healthy provider only when policy permits and record the actual provider used.
4. **Credential continuity:** prefer delegated authorization, refresh automatically, and request interactive authorization only when the refresh grant is invalid.
5. **Connector identity:** prevent duplicate registrations for the same external system unless an explicit routing policy distinguishes them.
6. **Deterministic startup:** pin connector versions and use stable caches outside temporary task directories.
7. **Lazy capability loading:** activate bounded product-group tools without requiring the entire desktop environment to restart.
8. **Meaningful user handoff:** when interactive authorization is unavoidable, open the exact consent screen and resume the blocked task automatically after completion.
9. **Operational evidence:** record connector version, health result, selected provider, recovery attempts, authorization state transition, and task resumption.

These requirements reinforce the existing OpenRabbit principles: implementations remain replaceable, provider identity remains truthful, delegated authorization is preferred, and recovery must preserve permissions and auditability.
