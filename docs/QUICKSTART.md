# OpenRabbit Quickstart

This guide is for anyone who receives the OpenRabbit repository and wants to test it on their own computer or development environment.

## What you can test without private credentials

The repository can be cloned, bootstrapped, validated, and the desktop workspace can be launched without access to the owner's private integrations.

Credential-backed features such as Google, OpenAI, Supabase, HubSpot, Camino, or other live providers remain optional. They should only be enabled with the tester's own credentials.

## Requirements

- Git
- Node.js 20 or newer
- npm

For desktop testing, use macOS, Windows, or Linux with a normal graphical desktop session.

## 1. Clone

```bash
git clone https://github.com/mxixo/OpenRabbit-Platform.git
cd OpenRabbit-Platform
```

## 2. Bootstrap the local environment

```bash
npm run bootstrap:local
```

This command:

- verifies the local Node.js version;
- installs the root package dependencies;
- installs the Electron desktop-shell dependencies;
- creates a local `.env` from `.env.example` only when `.env` does not already exist.

No secrets are added automatically.

## 3. Validate the repository

Run the cross-platform shareability smoke check:

```bash
npm run verify:shareable
```

For the repository's complete validation suite, run:

```bash
npm test
```

The canonical CI quality gates are also available on macOS/Linux environments with Bash:

```bash
npm run ci:quality-gates
```

## 4. Launch OpenRabbit Desktop

```bash
npm run desktop:start
```

This launches the current OpenRabbit workspace in Electron.

## 5. Build an installer locally

```bash
npm run desktop:dist
```

The generated installer is written to:

```text
clients/desktop-shell/dist/
```

Platform-specific builds are supported through GitHub Actions for macOS DMG, Windows NSIS, and Linux AppImage.

## Optional live integrations

Copy values into your local `.env` only for the services you intend to test. The template documents the available variables:

```text
.env.example
```

Do not commit `.env`, OAuth tokens, API keys, signing certificates, or other credentials.

Useful optional checks include:

```bash
npm run preflight:live
npm run preflight:productivity
```

These checks are intended for environments where the corresponding live credentials have been configured.

## Troubleshooting

### `node` or `npm` is not found

Install Node.js 20 or newer, then reopen your terminal.

### Desktop window does not open

Confirm you are running in a graphical desktop session and rerun:

```bash
npm run desktop:install
npm run desktop:start
```

### Live integrations fail

That is expected when the required credentials are not configured. The base repository and desktop shell should remain testable without private credentials.

## Tester's minimum acceptance check

A fresh tester should be able to:

1. clone the repository;
2. run `npm run bootstrap:local`;
3. run `npm run verify:shareable` successfully;
4. launch the workspace with `npm run desktop:start`;
5. optionally run `npm test` for the broader repository suite.

If any of those fail on a clean machine, please open a GitHub issue with the operating system, Node.js version, command run, and full error output.
