import type {
  ConnectorCapabilityContract,
  ConnectorCapabilityEvaluation,
  ConnectorCapabilityRequest
} from "../interfaces/connector-capability-contract.js";

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function validateConnectorCapabilityContract(
  contract: ConnectorCapabilityContract
): string[] {
  const reasons: string[] = [];
  const writeLike = ["external_write", "financial", "security_sensitive"].includes(
    contract.sideEffect
  );

  if (contract.contractVersion !== "openrabbit.connector-capability.v1") {
    reasons.push("unsupported_contract_version");
  }
  if (!contract.connectorId.trim()) reasons.push("connector_id_required");
  if (!contract.provider.trim()) reasons.push("provider_required");
  if (!contract.operation.trim()) reasons.push("operation_required");
  if (uniqueNonEmpty(contract.requiredCapabilities).length === 0) {
    reasons.push("required_capability_required");
  }
  if (contract.allowedExecutionModes.length === 0) {
    reasons.push("execution_mode_required");
  }
  if (contract.tenantIsolationRequired !== true) {
    reasons.push("tenant_isolation_must_be_required");
  }
  if (contract.rawSecretProjectionAllowed !== false) {
    reasons.push("raw_secret_projection_must_be_forbidden");
  }

  if (writeLike) {
    if (!contract.accountBindingRequired) reasons.push("account_binding_required_for_write");
    if (!contract.idempotencyRequired) reasons.push("idempotency_required_for_write");
    if (!contract.providerConfirmationRequired) {
      reasons.push("provider_confirmation_required_for_write");
    }
    if (contract.providerPolicy === "unknown") {
      reasons.push("provider_policy_unknown_for_write");
    }
  }

  if (contract.sideEffect === "financial" && contract.confirmationMode === "none") {
    reasons.push("financial_action_requires_confirmation_policy");
  }

  return reasons;
}

export function evaluateConnectorCapabilityRequest(
  contract: ConnectorCapabilityContract,
  request: ConnectorCapabilityRequest
): ConnectorCapabilityEvaluation {
  const reasons = validateConnectorCapabilityContract(contract);
  const requiredCapabilities = uniqueNonEmpty(contract.requiredCapabilities);
  const granted = new Set(uniqueNonEmpty(request.grantedCapabilities));
  const missingCapabilities = requiredCapabilities.filter((value) => !granted.has(value));
  const allowedContext = new Set(uniqueNonEmpty(contract.allowedContextCategories));
  const disallowedContextCategories = uniqueNonEmpty(request.contextCategories ?? []).filter(
    (value) => !allowedContext.has(value)
  );
  const writeLike = ["external_write", "financial", "security_sensitive"].includes(
    contract.sideEffect
  );

  if (request.connectorId !== contract.connectorId) reasons.push("connector_mismatch");
  if (request.operation !== contract.operation) reasons.push("operation_mismatch");
  if (!contract.allowedExecutionModes.includes(request.executionMode)) {
    reasons.push("execution_mode_not_allowed");
  }
  if (missingCapabilities.length > 0) reasons.push("missing_capability_authority");
  if (disallowedContextCategories.length > 0) reasons.push("context_scope_exceeded");

  if (writeLike) {
    if (request.providerAuthorized !== true) reasons.push("provider_not_authorized");
    if (request.targetAccountBound !== true) reasons.push("target_account_not_bound");
  }

  if (contract.idempotencyRequired && !request.idempotencyKey?.trim()) {
    reasons.push("idempotency_key_required");
  }

  return {
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    missingCapabilities,
    disallowedContextCategories
  };
}
