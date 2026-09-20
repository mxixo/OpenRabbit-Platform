"use strict";

const assert = require("assert");
const registry = require("../capabilities/registry.json");
const { createOnboardingProfile } = require("../runtime/onboarding-trust");
const { ActivationTracker } = require("../runtime/activation-metrics");
const {
  FIRST_WORKFLOW_ID,
  REQUIRED_CAPABILITIES,
  planFirstUsefulWorkflow,
  recordFirstWorkflowPreview,
} = require("../runtime/first-useful-workflow");

function profile(overrides = {}) {
  return createOnboardingProfile(
    {
      tenantId: "tenant-1",
      userId: "user-1",
      primaryWorkArea: "business",
      desiredOutcomes: ["deadline_awareness"],
      existingTools: ["gmail", "google_calendar"],
      startingState: "improve_existing",
      authorityProfile: "review_first",
      ...overrides,
    },
    new Date("2026-09-20T17:00:00Z")
  );
}

function trustedBackendEvidence() {
  return {
    authorizedAt: "2026-09-20T17:01:00Z",
    providerAccountId: "acct-1",
  };
}

(function clientClaimCannotFakeConnectionAuthority() {
  const plan = planFirstUsefulWorkflow({
    profile: profile(),
    registry,
    backendEvidence: null,
    clientConnectionState: "verified",
  });

  assert.equal(plan.workflowId, FIRST_WORKFLOW_ID);
  assert.equal(plan.status, "connection_required");
  assert.equal(plan.connectionState, "ready_to_connect");
  assert.equal(plan.executable, false);
  assert.equal(plan.previewOnly, true);
})();

(function trustedBackendEvidenceUnlocksOnlyReadOnlyPreviewPlan() {
  const plan = planFirstUsefulWorkflow({
    profile: profile(),
    registry,
    backendEvidence: trustedBackendEvidence(),
  });

  assert.equal(plan.status, "ready_for_preview");
  assert.equal(plan.connectionState, "connected");
  assert.equal(plan.executable, true);
  assert.equal(plan.previewOnly, true);
  assert.deepEqual(plan.requiredCapabilities, [...REQUIRED_CAPABILITIES]);
  assert.equal(plan.policyId, "onboarding-review-first-v1");
  assert.equal(plan.executionBoundary, "governed_workflow_required");
  assert.equal(plan.verificationBoundary, "independent_backend_evidence_required");
})();

(function missingCapabilityFailsClosed() {
  const incomplete = JSON.parse(JSON.stringify(registry));
  incomplete.capabilities = incomplete.capabilities.filter((item) => item.capability_id !== "mail.read");

  const plan = planFirstUsefulWorkflow({
    profile: profile(),
    registry: incomplete,
    backendEvidence: trustedBackendEvidence(),
  });

  assert.equal(plan.status, "blocked");
  assert.equal(plan.reason, "capability_registry_incomplete");
  assert.deepEqual(plan.missingCapabilities, ["mail.read"]);
  assert.equal(plan.executable, false);
})();

(function contractDriftToWriteFailsClosed() {
  const unsafe = JSON.parse(JSON.stringify(registry));
  const mailRead = unsafe.capabilities.find((item) => item.capability_id === "mail.read");
  mailRead.risk_level = "write_external";
  mailRead.default_execution_policy = "approval_required";

  const plan = planFirstUsefulWorkflow({
    profile: profile(),
    registry: unsafe,
    backendEvidence: trustedBackendEvidence(),
  });

  assert.equal(plan.status, "blocked");
  assert.equal(plan.reason, "capability_contract_not_read_only");
  assert.deepEqual(plan.unsafeCapabilities, ["mail.read"]);
})();

(function previewMilestoneRequiresTrustedReadyPlan() {
  const tracker = new ActivationTracker({
    tenantId: "tenant-1",
    userId: "user-1",
    sessionId: "session-1",
    startedAt: new Date("2026-09-20T17:00:00Z"),
  });
  const blocked = planFirstUsefulWorkflow({ profile: profile(), registry, backendEvidence: null });
  assert.throws(
    () => recordFirstWorkflowPreview({ plan: blocked, activationTracker: tracker }),
    /trusted connection evidence/
  );

  const ready = planFirstUsefulWorkflow({
    profile: profile(),
    registry,
    backendEvidence: trustedBackendEvidence(),
  });
  const event = recordFirstWorkflowPreview({
    plan: ready,
    activationTracker: tracker,
    occurredAt: new Date("2026-09-20T17:02:00Z"),
  });

  assert.equal(event.eventName, "preview_viewed");
  assert.equal(event.informationState, "simulated_preview");
  assert.equal(event.durationMs, 120000);
  assert.equal(Object.prototype.hasOwnProperty.call(event, "content"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(event, "backendEvidence"), false);
})();

(function unsupportedOutcomeDoesNotInventWorkflow() {
  const plan = planFirstUsefulWorkflow({
    profile: profile({ desiredOutcomes: ["cross_device_operation"] }),
    registry,
    backendEvidence: trustedBackendEvidence(),
  });
  assert.equal(plan.status, "no_supported_first_workflow");
  assert.equal(plan.workflowId, null);
  assert.equal(plan.executable, false);
})();

console.log("first-useful-workflow tests passed");
