# OpenRabbit Desktop

This package turns the existing OpenRabbit workspace client into installable desktop applications.

## Local development

From the repository root:

```bash
npm run desktop:install
npm run desktop:start
```

The desktop shell loads `clients/real-estate-workspace/index.html` locally while preserving Electron isolation and sandboxing.

## Build locally

```bash
npm run desktop:dist
```

Platform-specific installers are written to `clients/desktop-shell/dist/`.

## GitHub builds

The `Build OpenRabbit Desktop` workflow can be run manually from GitHub Actions. It builds:

- macOS DMG
- Windows NSIS installer
- Linux AppImage

Every manual build is saved as a GitHub Actions artifact. When a GitHub Release is published, the same workflow also attaches the generated installers to that release.

## Signing and notarization

Current builds are unsigned development distributions. Before public production distribution, add Apple Developer ID signing/notarization and Windows code signing credentials through GitHub Actions secrets. Never commit signing credentials to the repository.
