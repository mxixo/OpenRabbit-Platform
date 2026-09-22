# Connector Capability Contracts

OpenRabbit connector access is governed by machine-readable capability contracts outside the mutable worker/model context. A worker may request an operation; it cannot widen the operation, context scope, provider account, execution mode, or credential boundary at runtime.

## Security boundary

`worker request -> connector capability contract -> Guardian/trust policy -> credential broker/provider -> external effect -> provider confirmation -> Action Receipt`

The connector contract is a pre-execution authority boundary. The Action Receipt is post-decision/execution evidence. Neither substitutes for the other.

## Required properties

Every provider operation advertised as executable must bind:

- connector/provider/operation identity;
- risk tier and required capabilities;
- side-effect class;
- allowed execution modes (API/MCP/browser/local/human);
- minimum necessary context categories;
- credential mode without raw-secret projection;
- provider-policy status;
- tenant isolation and intended external account binding;
- idempotency and provider-confirmation behavior;
- confirmation policy and reversibility.

External writes, financial actions, and security-sensitive actions fail contract validation unless account binding, idempotency, provider confirmation, and an explicit provider policy are present. This prevents a worker from turning a read tool into a write path, switching to browser automation as an undeclared fallback, targeting a different account, or treating an unknown provider policy as permission.

## Context firewall

`allowedContextCategories` is an allowlist, not descriptive metadata. A tool-authorized worker is still denied when it requests unrelated personal context. Connector authority and personal-context authority are separate permissions.

## Confirmation without prompt fatigue

The contract supports `risk_based` confirmation. The existence of a financial or high-impact capability does not imply that every low-risk step should interrupt the user. Instead, the Guardian can escalate when risk, irreversibility, anomaly, identity freshness, provider policy, or amount thresholds require it. `none` is not a valid financial-action policy.

## Adversarial regressions

The reference runtime tests cover:

- missing capability authority;
- context-scope expansion/confused-deputy attempts;
- provider authorization failure;
- external account substitution;
- undeclared execution-mode substitution (for example API -> browser);
- replay-prone writes without idempotency keys;
- unsafe write contracts with unknown provider policy or no provider confirmation;
- financial contracts with no confirmation policy.

## Production boundary

This contract is a runtime primitive, not provider certification. Closed beta still requires durable tenant-isolated receipts/reconciliation, a designated production Auth/account boundary, a real provider lifecycle test, and evidence that the production credential broker/connector path actually enforces the declared contract.
