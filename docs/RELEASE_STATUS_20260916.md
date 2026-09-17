# OpenRabbit release and readiness ledger — September 16, 2026

Status recorded from implementation receipts, focused checks, and the owner's desktop verification. “Built,” “installed,” and “live” are separate states.

## Source and runtime boundaries

- GitHub is the platform's code and architectural source of truth.
- The production website is the existing Hostinger Horizons project serving openrabbit.app. Committing platform code or updating a VPS mirror does not publish Horizons.
- The installed Mac Website Workspace now loads the actual live website, including its OpenRabbit chat agent, layout, navigation, fonts, and colors. Published web changes appear after View → Reload.
- Mac Companion panels and native WidgetKit extensions are separate clients with separate release requirements. Website and Companion sign-in sessions must not be silently merged.
- “Open Rabbit Technologies” is branding, not proof of a registered legal entity or Apple enrollment. The unrelated BorrowUp team must not be used for OpenRabbit signing.

## Verified shipped

### Website and Mac parity

The replacement desktop app is installed and displays the live website instead of the older bundled dashboard. The preceding installed app was retained for rollback; existing Companion state was preserved. Website sign-in and live data were exercised in the installed app.

The existing web contact browser exposes searchable contact names and expandable details. Categorized document resources and social draft preparation are present; they are not the later pending template editor or complete publishing queue.

### Sign-in wordmark

A one-fragment Horizons change grouped the OpenRabbit wordmark text in one element. This preserves spacing next to the icon while eliminating the unwanted internal gap. No login handlers, provider configuration, permissions, or form behavior changed.

Verification:
- Saved source read back in the Horizons editor.
- Production wordmark verified after reloading the installed Website Workspace; the owner independently confirmed the correction.
- Initial post-release checks passed: website 200, API health 200, rejection of a public system-role message 400.
- A later rate-limit incident is recorded separately below; the initial smoke check is not a claim of uninterrupted service.
- Rollback is the inverse text-grouping edit against the current file, preserving intervening changes. The prepared future authentication release must retain this wordmark grouping.

## Connection incident — recovered, permanent fix pending

The signed-in Integrations screen temporarily reported errors for several previously connected providers. Website requests still returned 200 while API health and the public boundary check returned 429. The API later returned 200; one desktop reload restored the five previously connected services without email verification, provider reconnection, or credential changes.

Source inspection found an API-wide limit of 100 requests per five minutes. The dashboard contains duplicate approval polling and additional connection/data polling. In the inspected source, one Overview tab can schedule roughly 100–120 API requests within that window, before initial loads, focus events, and additional windows. Actual per-client grouping depends on the deployment; a cross-user shared bucket was not established.

The scoped client fix is in progress:
- Eliminate duplicate approval polling and limit overlapping/background refreshes.
- Honor rate-limit cooldown without automatically replaying writes or OAuth.
- Distinguish temporarily unavailable/stale status from disconnected accounts.
- Keep authentication, stored provider credentials, and server protection limits unchanged.

The refresh restored usability; it did not deploy this preventive code fix.

## Mac widgets — three different readiness levels

1. **Installed Companion panels:** movable Activity, Email, and Maps windows, available through the Widgets menu. These are not Apple's native desktop-gallery widgets. Opening a panel does not prove its feed is connected.
2. **Native five-widget source preview:** Activity, Email, CRM, Smart Docs, and Maps now have small and medium WidgetKit definitions and exact allowed website destinations. The isolated unsigned macOS build passed, as did five positive destination checks and 36 rejection cases. Every card remains explicitly marked Preview / Not connected. No fabricated feed data is shown.
3. **Still required for native release:** authorized signing setup, gallery installation, visual and tap verification, account-isolated snapshot sharing, live-feed wiring, and stale/offline/sign-out behavior. No native widgets have been installed on the desktop, and no live native feeds are claimed.

The Apple Development certificate option was disabled in the available Personal Team, and no usable signing identity was configured. No certificate, enrollment, payment, or company assignment was created.

## Prepared work that is not yet a production release

- **Smart Docs:** four original editable draft templates have passed focused review/build checks in an isolated source snapshot. They remain drafts, not attorney-approved contracts or execution-ready legal documents. Licensed association forms are separate and have not been bundled.
- **Social Queue:** reviewed proposal-card and queue changes remain separate from production. The tested provider boundary does not establish complete image publishing across all networks.
- **Remember-me/session renewal:** a reviewed authentication patch exists separately; it has not been published as part of the spacing fix. No Touch ID login or password-saving feature is claimed.
- **Visual finish:** rounded-link/button glow and connection-icon normalization patches are prepared separately; the wordmark release did not include them.
- **Private activity feed:** code-level progress does not establish a deployed universal Mac/VPS feed or a phone-accessible ChatGPT connector. Those remain integration milestones.
- **Custom white rabbit pet:** the logo-based animation package is in generation and visual QA. It has not been installed or selected.
- **Native mobile/desktop product expansion:** future direction, not an already distributed phone app.

## Previously recorded operating improvements

The operations notes record VPS-first heavy execution, an isolated development runner, a local resource guard, scheduled health checks, and conservative retention controls. These remain distinct from Horizons production deployment. This ledger did not independently rerun every infrastructure acceptance check.

## Next release sequence

1. Review and publish the focused polling/throttling client fix against current Horizons source, then verify live status without reconnecting providers.
2. Resolve native signing under an authorized team; install the five previews and verify them before claiming live feeds.
3. Wire account-isolated snapshots for the native widgets and universal Activity feed.
4. Publish the separately reviewed Smart Docs, Social Queue, authentication, and visual patches in scoped releases with rollback records.
5. Complete the pet's mandatory visual checks, then install and select the white rabbit as requested.

## Documentation scope

This ledger is a documentation update, not a deployment or a merge of all local work. The public record excludes credentials, personal mailbox contents, customer records, diagnostic screenshots, and private device paths.
