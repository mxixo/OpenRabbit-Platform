# OpenRabbit Cash App Connector Prototype

Experimental direct Cash App connector for OpenRabbit.

## Goal

Provide a persistent, user-authorized Cash App connection without screen scraping or storing a user's Cash App password.

## What the public Cash App APIs currently support

- Customer Request API: create an approval request and send the user into Cash App's authorization flow.
- Customer grants: inspect authorization granted by a Cash App customer.
- Checking balance: Cash App documents a beta `BALANCES_READ` endpoint authorized by a `CHECKING_BALANCE` customer action.
- Network API: server-side access requiring API-client credentials, region routing, and signed requests.

## Current blocker

As of September 11, 2026, Cash App's public partner documentation does **not** document a general endpoint for reading a consumer's complete personal transaction ledger. The documented `PAYMENTS_READ` scope is for payments handled through the Cash App Pay integration, which is not equivalent to all activity in a person's Cash App account.

For that reason, this prototype does not fabricate or scrape a transaction feed. `listTransactions()` intentionally throws `CASH_APP_TRANSACTION_HISTORY_UNAVAILABLE` until Block exposes or approves a legitimate read scope/end point.

## Prototype flow

1. OpenRabbit calls `POST /cash-app/connect`.
2. The connector creates a Cash App customer request with the `CHECKING_BALANCE` action.
3. The response contains Cash App authorization triggers such as a mobile URL / desktop URL / QR code.
4. The customer authorizes in Cash App.
5. OpenRabbit retrieves the request/grant, stores only the identifiers it needs, then reads permitted account data.
6. Data is normalized into OpenRabbit's provider-neutral financial model.
7. If/when Block grants consumer transaction-history access, the transaction adapter can be implemented without changing the UI-facing contract.

## Run locally

```bash
cd integrations/cash-app
cp .env.example .env
# Fill in sandbox credentials supplied by Cash App / Block.
set -a; source .env; set +a
npm start
```

Then:

```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/cash-app/connect
```

## Security rules

- Never collect a user's Cash App password.
- Never screen-scrape the consumer app as the production architecture.
- Keep Network API credentials server-side only.
- Encrypt stored Cash App data at rest and use TLS in transit.
- Rotate API keys according to Cash App's requirements.
- Use the least-privilege scopes needed.

## Production work remaining

- Obtain Cash App / Block partner sandbox credentials and the required client configuration.
- Validate `CHECKING_BALANCE` authorization end-to-end in sandbox.
- Implement production request signing once credentials are issued.
- Persist customer/request/grant/account identifiers in the OpenRabbit backend.
- Add webhook/event handling if provided for the approved program.
- Request/confirm a legitimate consumer transaction-history capability from Block.
- Add a fallback importer only as a secondary path if direct ledger access is unavailable.

## Relevant Cash App documentation

- Customer Request API: https://developers.cash.app/cash-app-pay-partner-api/guides/technical-guides/api-fundamentals/customer-request-api
- Making Requests / authentication: https://developers.cash.app/cash-app-pay-partner-api/guides/technical-guides/api-fundamentals/requests/making-requests
- Retrieve balance (beta): https://developers.cash.app/cash-app-pay-partner-api/api-reference/network-api/retrieve-balance
- Customer grants: https://developers.cash.app/cash-app-pay-partner-api/api-reference/network-api/list-customer-grants
- Scopes: https://developers.cash.app/cash-app-pay-partner-api/api-reference/management-api/scopes
