"use strict";

const assert = require("assert");
const {
  ActivationTracker,
  CONNECTION_EVIDENCE_MISMATCH,
  summarizeActivation,
} = require("../runtime/activation-metrics");

function tracker(overrides = {}) {
  return new ActivationTracker({
    tenantId: "tenant-a",
    userId: "user-1",
    sessionId: "session-1",
    startedAt: "2026-09-20T16:00:00Z",
    ...overrides,
  });
}

function testPreviewAndVerifiedWinTimingRequireEvidence() {
  const activation = tracker();
  activation.start();
  const preview = activation.recordPreview({
    occurredAt: "2026-09-20T16:00:30Z",
    informationState: "simulated_preview",
  });
  assert.strictEqual(preview.eventName, "preview_viewed");
  assert.strictEqual(preview.durationMs, 30000);

  assert.throws(
    () =>
      activation.recordVerifiedWin({
        providerId: "google",
        capabilityId: "calendar",
        occurredAt: "2026-09-20T16:02:00Z",
      }),
    /verificationEvidence is required/
  );

  const verified = activation.recordVerifiedWin({
    providerId: "google",
    capabilityId: "calendar",
    actionState: "verified",
    verificationEvidence: {
      verificationId: "verify-1",
      verifiedAt: "2026-09-20T16:01:55Z",
      outcomeConfirmed: true,
      privateEvidenceReference: "must-not-enter-analytics",
    },
    occurredAt: "2026-09-20T16:02:00Z",
  });
  assert.strictEqual(verified.eventName, "first_verified_win");
  assert.strictEqual(verified.actionState, "verified");
  assert.strictEqual(verified.durationMs, 120000);
  assert.ok(!Object.prototype.hasOwnProperty.call(verified, "verificationId"));
  assert.ok(!JSON.stringify(verified).includes("must-not-enter-analytics"));

  assert.throws(
    () =>
      activation.recordVerifiedWin({
        providerId: "google",
        capabilityId: "calendar",
        verificationEvidence: {
          verificationId: "verify-2",
          verifiedAt: "2026-09-20T16:02:30Z",
          outcomeConfirmed: true,
        },
        occurredAt: "2026-09-20T16:02:30Z",
      }),
    /immutable once recorded/
  );
}

function testIncorrectConnectedClaimUsesAuthoritativeBackendEvidence() {
  const activation = tracker();
  const mismatch = activation.recordConnectionObservation({
    claimedState: "connected",
    backendEvidence: { authorizedAt: "2026-09-20T16:00:05Z" },
    providerId: "google",
    capabilityId: "calendar",
    occurredAt: "2026-09-20T16:00:10Z",
  });
  assert.strictEqual(mismatch.connectionState, "ready_to_connect");
  assert.strictEqual(mismatch.success, false);
  assert.strictEqual(mismatch.errorCode, CONNECTION_EVIDENCE_MISMATCH);

  const verified = activation.recordConnectionObservation({
    claimedState: "verified",
    backendEvidence: {
      authorizedAt: "2026-09-20T16:00:05Z",
      providerAccountId: "provider-account-1",
      verifiedAt: "2026-09-20T16:00:15Z",
      verificationId: "verify-connection-1",
    },
    providerId: "google",
    capabilityId: "calendar",
    occurredAt: "2026-09-20T16:00:20Z",
  });
  assert.strictEqual(verified.connectionState, "verified");
  assert.strictEqual(verified.success, true);
  assert.strictEqual(verified.errorCode, undefined);
}

function testActivationSummaryMeasuresFirstMilestonesWithoutContent() {
  const a = tracker({ sessionId: "session-a" });
  const b = tracker({ sessionId: "session-b", userId: "user-2" });

  a.start();
  a.recordPreview({ occurredAt: "2026-09-20T16:00:20Z" });
  a.recordPreview({ occurredAt: "2026-09-20T16:00:40Z" });
  a.recordVerifiedWin({
    providerId: "google",
    capabilityId: "calendar",
    verificationEvidence: {
      verificationId: "verify-a",
      verifiedAt: "2026-09-20T16:01:00Z",
      outcomeConfirmed: true,
    },
    occurredAt: "2026-09-20T16:01:00Z",
  });

  b.start();
  b.recordPreview({ occurredAt: "2026-09-20T16:01:00Z" });
  b.recordConnectionObservation({
    claimedState: "verified",
    backendEvidence: null,
    providerId: "hubspot",
    capabilityId: "crm",
    occurredAt: "2026-09-20T16:01:10Z",
  });

  const summary = summarizeActivation([...a.snapshot(), ...b.snapshot()]);
  assert.strictEqual(summary.sessionsStarted, 2);
  assert.strictEqual(summary.previewedSessions, 2);
  assert.strictEqual(summary.verifiedWinSessions, 1);
  assert.strictEqual(summary.previewRate, 1);
  assert.strictEqual(summary.verifiedWinRate, 0.5);
  assert.deepStrictEqual(summary.timeToFirstPreviewMs, {
    samples: 2,
    mean: 40000,
    median: 40000,
  });
  assert.deepStrictEqual(summary.timeToFirstVerifiedWinMs, {
    samples: 1,
    mean: 60000,
    median: 60000,
  });
  assert.strictEqual(summary.incorrectConnectedStateIncidents, 1);
}

function testVerifiedWinCannotBeClaimedFromUnverifiedActionOrFutureEvidence() {
  const activation = tracker();
  assert.throws(
    () =>
      activation.recordVerifiedWin({
        providerId: "google",
        capabilityId: "calendar",
        actionState: "completed",
        verificationEvidence: {
          verificationId: "verify-1",
          verifiedAt: "2026-09-20T16:00:30Z",
          outcomeConfirmed: true,
        },
        occurredAt: "2026-09-20T16:00:30Z",
      }),
    /actionState=verified/
  );

  assert.throws(
    () =>
      activation.recordVerifiedWin({
        providerId: "google",
        capabilityId: "calendar",
        verificationEvidence: {
          verificationId: "verify-1",
          verifiedAt: "2026-09-20T16:01:00Z",
          outcomeConfirmed: true,
        },
        occurredAt: "2026-09-20T16:00:30Z",
      }),
    /cannot be timestamped after/
  );
}

function runTests() {
  testPreviewAndVerifiedWinTimingRequireEvidence();
  testIncorrectConnectedClaimUsesAuthoritativeBackendEvidence();
  testActivationSummaryMeasuresFirstMilestonesWithoutContent();
  testVerifiedWinCannotBeClaimedFromUnverifiedActionOrFutureEvidence();
  console.log("Activation and verified first-win metric tests passed.");
}

runTests();
