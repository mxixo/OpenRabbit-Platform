"use strict";

const assert = require("assert");
const {
  deriveManagedConnectionState,
  buildContextualAuthorizationRequest,
  connectionTrustCenterEntry,
  buildDisconnectRequest,
} = require("../runtime/connection-trust-center");

function baseEvidence(overrides = {}) {
  return {
    authorizedAt: "2026-09-20T18:00:00Z",
    providerAccountId: "provider-account-1",
    verifiedAt: "2026-09-20T18:01:00Z",
    verificationId: "verify-1",
    ...overrides,
  };
}

function testAuthorizationRequiresActiveCapabilityContext() {
  const request = buildContextualAuthorizationRequest(
    {
      tenantId: "tenant-a",
      userId: "user-1",
      providerId: "google",
      capabilityId: "calendar.read",
      activeCapabilityIds: ["calendar.read"],
      requestedAccess: "read_only",
      explanation: {
        capability: "Read upcoming calendar events",
        requestedAccess: "read_only",
        willDo: "Prepare deadline and meeting reminders",
        willNotDo: "Create, edit, or delete events",
        reasonNow: "You selected deadline awareness",
        disconnectPath: "Connections > Google Calendar > Disconnect",
      },
    },
    new Date("2026-09-20T18:05:00Z")
  );

  assert.strictEqual(request.providerId, "google");
  assert.strictEqual(request.capabilityId, "calendar.read");
  assert.strictEqual(request.connectionState, "authorization_in_progress");
  assert.strictEqual(request.permissionExplanation.writeAuthority, false);

  assert.throws(
    () => buildContextualAuthorizationRequest({
      tenantId: "tenant-a",
      userId: "user-1",
      providerId: "google",
      capabilityId: "mail.write",
      activeCapabilityIds: ["calendar.read"],
      requestedAccess: "read_write",
      explanation: {
        capability: "Send email",
        requestedAccess: "read_write",
        willDo: "Send approved messages",
        willNotDo: "Send messages outside the approved workflow",
        reasonNow: "Not currently active",
        disconnectPath: "Connections > Google > Disconnect",
      },
    }),
    /active capability context/
  );
}

function testClientClaimsCannotCreateConnectedOrVerifiedState() {
  const entry = connectionTrustCenterEntry({
    tenantId: "tenant-a",
    userId: "user-1",
    providerId: "google",
    capabilityIds: ["calendar.read"],
    clientClaimedState: "verified",
  });
  assert.strictEqual(entry.connectionState, "ready_to_connect");
  assert.strictEqual(entry.providerAccountId, null);
}

function testRevokedExpiredAndDisconnectedEvidenceRecoverTruthfully() {
  assert.strictEqual(
    deriveManagedConnectionState({ backendEvidence: baseEvidence({ revokedAt: "2026-09-20T18:10:00Z" }) }),
    "needs_attention"
  );
  assert.strictEqual(
    deriveManagedConnectionState({ backendEvidence: baseEvidence({ expiredAt: "2026-09-20T18:10:00Z" }) }),
    "needs_attention"
  );
  assert.strictEqual(
    deriveManagedConnectionState({ backendEvidence: baseEvidence({ verificationFailedAt: "2026-09-20T18:10:00Z" }) }),
    "needs_attention"
  );
  assert.strictEqual(
    deriveManagedConnectionState({ backendEvidence: baseEvidence({ disconnectedAt: "2026-09-20T18:10:00Z" }) }),
    "ready_to_connect"
  );
  assert.strictEqual(
    deriveManagedConnectionState({
      authorizationInProgress: true,
      backendEvidence: baseEvidence({ expiredAt: "2026-09-20T18:10:00Z" }),
    }),
    "authorization_in_progress"
  );
}

function testTrustCenterExposesOnlySafeReviewFields() {
  const entry = connectionTrustCenterEntry({
    tenantId: "tenant-a",
    userId: "user-1",
    providerId: "google",
    capabilityIds: ["calendar.read", "mail.read"],
    backendEvidence: {
      ...baseEvidence(),
      accessToken: "must-never-leak",
      refreshToken: "must-never-leak",
      clientSecret: "must-never-leak",
    },
  });

  assert.strictEqual(entry.connectionState, "verified");
  assert.strictEqual(entry.recoveryAction, "none");
  assert.strictEqual(entry.canDisconnect, true);
  assert.strictEqual(entry.providerAccountId, "provider-account-1");
  const serialized = JSON.stringify(entry);
  assert.ok(!serialized.includes("must-never-leak"));
  assert.ok(!serialized.includes("accessToken"));
  assert.ok(!serialized.includes("refreshToken"));
  assert.ok(!serialized.includes("clientSecret"));
}

function testDisconnectRequestIsScopedAndSecretFree() {
  const request = buildDisconnectRequest(
    {
      tenantId: "tenant-a",
      userId: "user-1",
      providerId: "google",
      capabilityIds: ["mail.read", "calendar.read"],
      backendEvidence: baseEvidence(),
    },
    new Date("2026-09-20T18:20:00Z")
  );

  assert.deepStrictEqual(request.capabilityIds, ["calendar.read", "mail.read"]);
  assert.strictEqual(request.operation, "disconnect_provider");
  assert.strictEqual(request.tenantId, "tenant-a");
  assert.strictEqual(request.providerAccountId, "provider-account-1");

  assert.throws(
    () => buildDisconnectRequest({
      tenantId: "tenant-a",
      userId: "user-1",
      providerId: "google",
      capabilityIds: ["mail.read"],
      backendEvidence: baseEvidence(),
      accessToken: "secret",
    }),
    /not allowed in the trust-center contract/
  );

  assert.throws(
    () => buildDisconnectRequest({
      tenantId: "tenant-a",
      userId: "user-1",
      providerId: "google",
      capabilityIds: ["mail.read"],
    }),
    /not disconnectable/
  );
}

function runTests() {
  testAuthorizationRequiresActiveCapabilityContext();
  testClientClaimsCannotCreateConnectedOrVerifiedState();
  testRevokedExpiredAndDisconnectedEvidenceRecoverTruthfully();
  testTrustCenterExposesOnlySafeReviewFields();
  testDisconnectRequestIsScopedAndSecretFree();
  console.log("Connection trust-center tests passed.");
}

runTests();
