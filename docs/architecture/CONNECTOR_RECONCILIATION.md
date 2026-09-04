# Connector Reconciliation Plan

**Status:** Implementation guidance for reconciling Hostinger-prototyped integrations with OpenRabbit Platform.

## Goal

Allow rapid connector prototyping in Hostinger Horizons without creating permanent duplicate implementations or conflicting sources of truth.

## Reconciliation checklist per provider

Record for each live connector:

- provider and account type
- OAuth client/application ownership
- requested scopes
- authorized origins and redirect URIs
- access-token lifetime and refresh-token behavior
- revocation/disconnect behavior
- provider API endpoints used
- normalized OpenRabbit tools exposed
- read vs write actions
- approval/autonomy requirements
- errors and retry behavior
- data models and response shapes consumed by clients
- webhook/background requirements
- audit events produced
- current owner: Horizons prototype, Platform backend, or external adapter

## Ownership rule

Exactly one canonical backend implementation should own each provider capability once productionized. Web, mobile, desktop, and CLI consume it through Platform APIs.

Temporary duplicate code is allowed only during migration and must have an explicit removal target.

## Normalization examples

Provider-specific calls should converge on provider-independent tool contracts such as:

```text
email.search
email.read
email.send
email.reply
calendar.list
calendar.create
calendar.update
crm.search
crm.create_contact
crm.update_deal
maps.geocode
maps.place_details
social.publish
```

The integration adapter translates normalized operations into provider-specific APIs.

## First reconciliation milestone

After Hostinger successfully connects real Google and HubSpot accounts:

1. capture exact working OAuth configuration,
2. map the live actions to OpenRabbit tool names,
3. inspect existing GitHub connector/integration code for overlap,
4. choose the canonical owner for each capability,
5. add or adapt Platform API endpoints,
6. point Horizons at those APIs,
7. remove obsolete duplicate logic only after parity tests pass.

## Parity test

A connector is reconciled when the same OpenRabbit command can be initiated from two clients and produces the same normalized backend behavior, policy decision, audit record, and provider-side result.
