"use strict";

const {
  CONNECTION_STATES,
  deriveConnectionState,
  permissionExplanation,
} = require("./onboarding-trust");

const RECOVERY_ACTION_BY_STATE = Object.freeze({
  available: "connect",
  ready_to_connect: "connect",
  authorization_in_progress: "complete_provider_authorization",
  connected: "none",
  verified: "none",
  needs_attention: "reauthorize",
  unavailable: "retry_later",
});

const DISCONNECTABLE_STATES = Object.freeze(["connected", "verified", "needs_attention"]);
const SECRETISH_KEY = /(token|secret|password|authorization|cookie|credential|private[_-]?key)/i;

function requiredString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
}

function ensureNoSecretFields(value, path = "input") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRETISH_KEY.test(key)) {
      throw new Error(`${path}.${key} is not allowed in the trust-center contract`);
    }
    if (child && typeof child === "object") ensureNoSecretFields(child, `${path}.${key}`);
  }
}

function deriveManagedConnectionState({
  available = true,
  authorizationInProgress = false,
  backendEvidence = null,
} = {}) {
  if (!available) return "unavailable";
  if (authorizationInProgress) return "authorization_in_progress";

  const evidence = backendEvidence && typeof backendEvidence === "object" ? backendEvidence : {};

  // Explicit user disconnect is authoritative even if old authorization metadata
  // remains available for audit/recovery. It must never display as Connected.
  if (evidence.disconnectedAt) return "ready_to_connect";

  // Provider revocation, token expiry, or failed verification invalidates the
  // prior connection until new backend evidence is obtained.
  if (evidence.revokedAt || evidence.expiredAt || evidence.verificationFailedAt) {
    return "needs_attention";
  }

  return deriveConnectionState({ backendEvidence: evidence });
}

function buildContextualAuthorizationRequest(input, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("authorization input is required");
  ensureNoSecretFields(input);

  const tenantId = requiredString(input.tenantId, "tenantId");
  const userId = requiredString(input.userId, "userId");
  const providerId = requiredString(input.providerId, "providerId");
  const capabilityId = requiredString(input.capabilityId, "capabilityId");
  const activeCapabilityIds = uniqueStrings(input.activeCapabilityIds || [], "activeCapabilityIds");
  if (!activeCapabilityIds.includes(capabilityId)) {
    throw new Error("authorization may only be requested for an active capability context");
  }

  const explanation = permissionExplanation(input.explanation || {});
  if (explanation.requestedAccess !== input.requestedAccess) {
    throw new Error("requestedAccess must match the permission explanation");
  }

  return {
    schemaVersion: 1,
    tenantId,
    userId,
    providerId,
    capabilityId,
    requestedAccess: explanation.requestedAccess,
    permissionExplanation: explanation,
    connectionState: "authorization_in_progress",
    requestedAt: new Date(now).toISOString(),
  };
}

function connectionTrustCenterEntry(input) {
  if (!input || typeof input !== "object") throw new Error("connection input is required");

  const tenantId = requiredString(input.tenantId, "tenantId");
  const userId = requiredString(input.userId, "userId");
  const providerId = requiredString(input.providerId, "providerId");
  const capabilityIds = uniqueStrings(input.capabilityIds || [], "capabilityIds");
  const evidence = input.backendEvidence && typeof input.backendEvidence === "object"
    ? input.backendEvidence
    : {};
  const state = deriveManagedConnectionState({
    available: input.available !== false,
    authorizationInProgress: Boolean(input.authorizationInProgress),
    backendEvidence: evidence,
  });

  if (!CONNECTION_STATES.includes(state)) throw new Error(`unsupported connection state: ${state}`);

  return {
    schemaVersion: 1,
    tenantId,
    userId,
    providerId,
    providerAccountId: evidence.providerAccountId ? String(evidence.providerAccountId) : null,
    capabilityIds,
    connectionState: state,
    recoveryAction: RECOVERY_ACTION_BY_STATE[state],
    canDisconnect: DISCONNECTABLE_STATES.includes(state),
    authorizedAt: evidence.authorizedAt ? String(evidence.authorizedAt) : null,
    verifiedAt: evidence.verifiedAt ? String(evidence.verifiedAt) : null,
    lastFailureCode: input.lastFailureCode ? String(input.lastFailureCode) : null,
  };
}

function buildDisconnectRequest(input, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("disconnect input is required");
  ensureNoSecretFields(input);

  const entry = connectionTrustCenterEntry(input);
  if (!entry.canDisconnect) {
    throw new Error(`connection state ${entry.connectionState} is not disconnectable`);
  }
  if (!entry.providerAccountId) {
    throw new Error("providerAccountId is required to disconnect a provider account");
  }

  return {
    schemaVersion: 1,
    operation: "disconnect_provider",
    tenantId: entry.tenantId,
    userId: entry.userId,
    providerId: entry.providerId,
    providerAccountId: entry.providerAccountId,
    capabilityIds: entry.capabilityIds,
    requestedAt: new Date(now).toISOString(),
  };
}

module.exports = {
  RECOVERY_ACTION_BY_STATE,
  DISCONNECTABLE_STATES,
  deriveManagedConnectionState,
  buildContextualAuthorizationRequest,
  connectionTrustCenterEntry,
  buildDisconnectRequest,
};
