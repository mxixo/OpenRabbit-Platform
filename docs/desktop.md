# OpenRabbit Desktop

OpenRabbit Desktop packages the existing real-estate workspace inside an Electron shell without changing the browser client's `/v1/...` API contract.

## Architecture

The Electron main process starts a loopback-only HTTP server on `127.0.0.1` using a random available port. That server:

- serves `clients/real-estate-workspace` locally;
- proxies `/v1/...` requests to the configured OpenRabbit API;
- keeps Node integration disabled in the renderer;
- opens external web links in the user's default browser.

The API target defaults to `http://127.0.0.1:3000` and can be overridden with:

```bash
OPENRABBIT_API_BASE_URL=https://api.example.com npm run desktop
```

## Local development

Install dependencies and start the current OpenRabbit API separately, then launch the desktop shell:

```bash
npm install
npm run start:real-estate-api
npm run desktop
```

If the API is hosted elsewhere, set `OPENRABBIT_API_BASE_URL` before launching the desktop app.

## Build installers locally

```bash
npm run desktop:build
```

Build output is written to `release/`.

Configured targets:

- macOS: `.dmg`
- Windows: NSIS `.exe`
- Linux: `.AppImage`

## GitHub Actions

`.github/workflows/desktop-build.yml` supports manual builds and tagged releases.

A manual workflow run builds installers as GitHub Actions artifacts. A tag matching `desktop-v*` builds all three platforms and publishes the resulting installers to a GitHub Release.

Example release tag:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

## Signing and notarization

The first packaging milestone intentionally disables automatic code-signing discovery. Production distribution should add platform signing through encrypted GitHub Actions secrets:

- Apple Developer ID signing and notarization for macOS;
- Authenticode signing for Windows.

Signing credentials must never be committed to the repository.

## Next desktop milestones

1. Add branded application icons and installer artwork.
2. Add a desktop connection/onboarding screen for selecting a hosted OpenRabbit API or configuring a local runtime.
3. Add secure local credential storage using the operating system keychain.
4. Decide which OpenRabbit capabilities should execute locally versus through the hosted backend.
5. Add automatic update support after signed releases are stable.
