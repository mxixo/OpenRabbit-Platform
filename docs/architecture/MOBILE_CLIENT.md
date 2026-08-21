# Mobile Client Architecture

**Status:** Implementation guidance; canonical architecture remains `docs/ARCHITECTURE.md`.

## Principle

The OpenRabbit mobile app is another client of the same OpenRabbit Platform API. It must not become a second backend or duplicate Gmail, Calendar, CRM, Maps, social, workflow, or agent logic.

## Shared system

```text
Web (Hostinger) ----\
Mobile ------------- > OpenRabbit Platform API -> Core/Runtime/Capabilities/Integrations
Desktop ------------/
CLI ----------------/
```

## UI strategy

The Hostinger web app should be mobile-responsive now and serve as the design/reference implementation for phone-sized layouts. A future store-distributed mobile client may reuse that design language and selected web assets, but native packaging and native device capabilities belong in the GitHub-controlled mobile client.

## Mobile-specific responsibilities

- Native app lifecycle and store packaging
- Push notifications
- Deep links
- Biometric/device authentication hooks where appropriate
- Native share/attachment/camera/microphone surfaces where appropriate
- App badges and mobile approval actions
- Secure local session handling

## Backend rule

Mobile screens call versioned Platform APIs. They never contain provider-specific OAuth secrets or independent business workflow implementations.

## Repository target

A future implementation should live under `clients/mobile` (or an equivalent approved client package) and consume public OpenRabbit API contracts. Shared schemas/types should come from public package entrypoints rather than copied definitions.

## Store-readiness checkpoint

Do not optimize for App Store / Play Store submission until:

1. responsive web UX is stable,
2. real connectors work end-to-end,
3. Platform API contracts are stable enough for a second client,
4. authentication/session behavior is defined for mobile,
5. native features add value beyond a bare website wrapper.
