import { describe, expect, it } from "vitest";
import {
  evaluateConnectorCapabilityRequest,
  validateConnectorCapabilityContract
} from "../../src/core/connector-capability-policy.js";
import type { ConnectorCapabilityContract } from "../../src/interfaces/connector-capability-contract.js";

function contract(
  overrides: Partial<ConnectorCapabilityContract> = {}
): ConnectorCapabilityContract {
  return {
    contractVersion: "openrabbit.connector-capability.v1",
    connectorId: "google-calendar",
    provider: "google",
    operation: "calendar.create_event",
    risk: "moderate",
    requiredCapabilities: ["calendar.write"],
    sideEffect: "external_write",
    allowedExecutionModes: ["native_api"],
    allowedContextCategories: ["calendar_availability", "attendee_identity"],
    credentialMode: "delegated_oauth",
    providerPolicy: "allowed",
    tenantIsolationRequired: true,
    accountBindingRequired: true,
    rawSecretProjectionAllowed: false,
    idempotencyRequired: true,
    providerConfirmationRequired: true,
    confirmationMode: "risk_based",
    reversible: true,
    ...overrides
  };
}

describe("connector capability contracts", () => {
  it("accepts a scoped authorized write", () => {
    const result = evaluateConnectorCapabilityRequest(contract(), {
      connectorId: "google-calendar",
      operation: "calendar.create_event",
      executionMode: "native_api",
      grantedCapabilities: ["calendar.write"],
      contextCategories: ["calendar_availability"],
      providerAuthorized: true,
      targetAccountBound: true,
      idempotencyKey: "task-1:create-event:1"
    });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks context expansion even when the worker has tool authority", () => {
    const result = evaluateConnectorCapabilityRequest(contract(), {
      connectorId: "google-calendar",
      operation: "calendar.create_event",
      executionMode: "native_api",
      grantedCapabilities: ["calendar.write"],
      contextCategories: ["calendar_availability", "financial_profile"],
      providerAuthorized: true,
      targetAccountBound: true,
      idempotencyKey: "task-1:create-event:2"
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("context_scope_exceeded");
    expect(result.disallowedContextCategories).toEqual(["financial_profile"]);
  });

  it("blocks account substitution and unknown provider authority", () => {
    const result = evaluateConnectorCapabilityRequest(contract(), {
      connectorId: "google-calendar",
      operation: "calendar.create_event",
      executionMode: "native_api",
      grantedCapabilities: ["calendar.write"],
      providerAuthorized: false,
      targetAccountBound: false,
      idempotencyKey: "task-1:create-event:3"
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("provider_not_authorized");
    expect(result.reasons).toContain("target_account_not_bound");
  });

  it("blocks execution-mode substitution such as browser fallback", () => {
    const result = evaluateConnectorCapabilityRequest(contract(), {
      connectorId: "google-calendar",
      operation: "calendar.create_event",
      executionMode: "browser",
      grantedCapabilities: ["calendar.write"],
      providerAuthorized: true,
      targetAccountBound: true,
      idempotencyKey: "task-1:create-event:4"
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("execution_mode_not_allowed");
  });

  it("blocks replay-prone writes without an idempotency key", () => {
    const result = evaluateConnectorCapabilityRequest(contract(), {
      connectorId: "google-calendar",
      operation: "calendar.create_event",
      executionMode: "native_api",
      grantedCapabilities: ["calendar.write"],
      providerAuthorized: true,
      targetAccountBound: true
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("idempotency_key_required");
  });

  it("rejects unsafe write contracts before they can authorize anything", () => {
    const reasons = validateConnectorCapabilityContract(
      contract({
        providerPolicy: "unknown",
        accountBindingRequired: false,
        idempotencyRequired: false,
        providerConfirmationRequired: false
      })
    );

    expect(reasons).toContain("provider_policy_unknown_for_write");
    expect(reasons).toContain("account_binding_required_for_write");
    expect(reasons).toContain("idempotency_required_for_write");
    expect(reasons).toContain("provider_confirmation_required_for_write");
  });

  it("requires a confirmation policy for financial actions without forcing every action to prompt", () => {
    const unsafe = validateConnectorCapabilityContract(
      contract({ sideEffect: "financial", confirmationMode: "none" })
    );
    const riskBased = validateConnectorCapabilityContract(
      contract({ sideEffect: "financial", confirmationMode: "risk_based" })
    );

    expect(unsafe).toContain("financial_action_requires_confirmation_policy");
    expect(riskBased).not.toContain("financial_action_requires_confirmation_policy");
  });
});
