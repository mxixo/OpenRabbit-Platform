"use strict";

const assert = require("assert");
const {
  QUESTION_EFFECTS,
  AUTHORITY_POLICY_CONTRACTS,
  createOnboardingProfile,
  revisitOnboardingProfile,
  resetOnboardingProfile,
  exportOnboardingProfile,
  deleteOnboardingProfile,
  deriveConnectionState,
  connectionTruth,
  permissionExplanation,
  buildTrustEvent,
} = require("../runtime/onboarding-trust");

function baseInput(overrides = {}) {
  return {
    tenantId: "tenant-a",
    userId: "user-1",
    primaryWorkArea: "real_estate",
    secondaryWorkAreas: ["business"],
    desiredOutcomes: ["lead_deal_movement", "deadline_awareness"],
    existingTools: ["gmail", "hubspot"],
    startingState: "improve_existing",
    presentationPreferenceIds: ["dense-calendar-v1"],
    authorityProfile: "review_first",
    ...overrides,
  };
}

function testEveryQuestionHasDocumentedDownstreamEffect() {
  const requiredQuestions = [
    "primaryWorkArea",
    "secondaryWorkAreas",
    "desiredOutcomes",
    "existingTools",
    "startingState",
    "presentationPreferenceIds",
    "authorityProfile",
  ];
  assert.deepStrictEqual(Object.keys(QUESTION_EFFECTS).sort(), requiredQuestions.sort());
  for (const question of requiredQuestions) {
    assert.ok(Array.isArray(QUESTION_EFFECTS[question]));
    assert.ok(QUESTION_EFFECTS[question].length > 0, `${question} must have a downstream effect`);
  }

  const profile = createOnboardingProfile(baseInput(), new Date("2026-09-20T16:00:00Z"));
  assert.strictEqual(profile.recommendations.recommendedIndustryPack, "real-estate");
  assert.strictEqual(profile.recommendations.workspaceLayout, "dense-calendar-v1");
  assert.deepStrictEqual(profile.recommendations.workspaceModules, ["crm", "calendar"]);
  assert.deepStrictEqual(
    profile.recommendations.recommendedConnectionPlan.map((item) => item.toolId),
    ["gmail", "hubspot"]
  );
  assert.strictEqual(profile.recommendations.firstWorkflowMode, "improve_existing");
  assert.deepStrictEqual(profile.recommendations.policyContract, AUTHORITY_POLICY_CONTRACTS.review_first);
}

function testConnectedAndVerifiedRequireAuthoritativeEvidence() {
  assert.strictEqual(deriveConnectionState({}), "ready_to_connect");
  assert.strictEqual(
    deriveConnectionState({ authorizationInProgress: true }),
    "authorization_in_progress"
  );
  assert.strictEqual(
    deriveConnectionState({ backendEvidence: { authorizedAt: "2026-09-20T16:00:00Z" } }),
    "ready_to_connect",
    "an authorization timestamp without provider identity is not authoritative enough"
  );
  assert.strictEqual(
    deriveConnectionState({
      backendEvidence: {
        authorizedAt: "2026-09-20T16:00:00Z",
        providerAccountId: "provider-account-1",
      },
    }),
    "connected"
  );
  assert.strictEqual(
    deriveConnectionState({
      backendEvidence: {
        authorizedAt: "2026-09-20T16:00:00Z",
        providerAccountId: "provider-account-1",
        verifiedAt: "2026-09-20T16:01:00Z",
      },
    }),
    "connected",
    "verification requires an independent verification id"
  );
  assert.strictEqual(
    deriveConnectionState({
      backendEvidence: {
        authorizedAt: "2026-09-20T16:00:00Z",
        providerAccountId: "provider-account-1",
        verifiedAt: "2026-09-20T16:01:00Z",
        verificationId: "verify-1",
      },
    }),
    "verified"
  );
}

function testNetworkReachabilityDoesNotGrantCapabilityAuthority() {
  const truth = connectionTruth({ networkReachable: true });
  assert.strictEqual(truth.networkReachable, true);
  assert.strictEqual(truth.connectionState, "ready_to_connect");
  assert.deepStrictEqual(truth.capabilityAuthority, {
    read: false,
    write: false,
    destructiveWrite: false,
  });

  const explicit = connectionTruth({
    networkReachable: false,
    backendEvidence: {
      authorizedAt: "2026-09-20T16:00:00Z",
      providerAccountId: "provider-account-1",
    },
    capabilityAuthority: { read: true, write: false, destructiveWrite: false },
  });
  assert.strictEqual(explicit.networkReachable, false);
  assert.strictEqual(explicit.connectionState, "connected");
  assert.strictEqual(explicit.capabilityAuthority.read, true);
  assert.strictEqual(explicit.capabilityAuthority.write, false);
}

function testPermissionExplanationIsContextualAndExplicit() {
  const explanation = permissionExplanation({
    capability: "Read upcoming calendar events",
    requestedAccess: "read_only",
    willDo: "Prepare deadline and meeting reminders",
    willNotDo: "Create, edit, or delete events",
    reasonNow: "You selected deadline awareness",
    disconnectPath: "Connections > Google Calendar > Disconnect",
  });
  assert.strictEqual(explanation.writeAuthority, false);
  assert.throws(
    () => permissionExplanation({ capability: "Email", requestedAccess: "read_write" }),
    /willDo is required/
  );
}

function testAnalyticsAreAllowlistedAndContentFree() {
  const event = buildTrustEvent("connection_state_changed", {
    tenantId: "tenant-a",
    userId: "user-1",
    providerId: "google",
    capabilityId: "calendar",
    connectionState: "verified",
    success: true,
    occurredAt: "2026-09-20T16:00:00Z",
  });
  assert.strictEqual(event.schemaVersion, 1);
  assert.strictEqual(event.connectionState, "verified");

  for (const forbidden of ["messageContent", "accessToken", "clientSecret", "prompt", "emailBody", "password"]) {
    assert.throws(
      () => buildTrustEvent("preview_viewed", { [forbidden]: "sensitive" }),
      /analytics field is forbidden/
    );
  }
  assert.throws(
    () => buildTrustEvent("preview_viewed", { arbitraryDimension: "surprise" }),
    /not allowlisted/
  );
}

function testProfileSupportsRevisitResetExportAndDeletion() {
  const created = createOnboardingProfile(baseInput(), new Date("2026-09-20T16:00:00Z"));
  const revisited = revisitOnboardingProfile(
    created,
    { answers: { authorityProfile: "assist_automatically" }, currentStep: "authority_profile" },
    new Date("2026-09-20T16:10:00Z")
  );
  assert.strictEqual(revisited.revision, 2);
  assert.strictEqual(revisited.answers.primaryWorkArea, "real_estate");
  assert.strictEqual(revisited.answers.authorityProfile, "assist_automatically");
  assert.strictEqual(
    revisited.recommendations.policyContract.policyId,
    "onboarding-assist-automatically-v1"
  );

  const exported = exportOnboardingProfile(revisited);
  assert.deepStrictEqual(exported, revisited);
  exported.answers.primaryWorkArea = "personal";
  assert.strictEqual(revisited.answers.primaryWorkArea, "real_estate", "export must be a detached copy");

  const reset = resetOnboardingProfile(revisited, new Date("2026-09-20T16:20:00Z"));
  assert.strictEqual(reset.currentStep, "work_identity");
  assert.strictEqual(reset.answers, null);
  assert.strictEqual(reset.recommendations, null);
  assert.ok(reset.resetAt);

  const tombstone = deleteOnboardingProfile(revisited, new Date("2026-09-20T16:30:00Z"));
  assert.deepStrictEqual(Object.keys(tombstone).sort(), [
    "deletedAt",
    "revision",
    "schemaVersion",
    "tenantId",
    "userId",
  ]);
  assert.ok(tombstone.deletedAt);
}

function testTenantIdentityCannotBeChangedDuringRevisit() {
  const created = createOnboardingProfile(baseInput(), new Date("2026-09-20T16:00:00Z"));
  const revisited = revisitOnboardingProfile(
    created,
    {
      tenantId: "tenant-b",
      userId: "user-2",
      answers: { desiredOutcomes: ["decision_preparation"] },
    },
    new Date("2026-09-20T16:05:00Z")
  );
  assert.strictEqual(revisited.tenantId, "tenant-a");
  assert.strictEqual(revisited.userId, "user-1");
}

function runTests() {
  testEveryQuestionHasDocumentedDownstreamEffect();
  testConnectedAndVerifiedRequireAuthoritativeEvidence();
  testNetworkReachabilityDoesNotGrantCapabilityAuthority();
  testPermissionExplanationIsContextualAndExplicit();
  testAnalyticsAreAllowlistedAndContentFree();
  testProfileSupportsRevisitResetExportAndDeletion();
  testTenantIdentityCannotBeChangedDuringRevisit();
  console.log("Onboarding trust contract tests passed.");
}

runTests();
