"use strict";

const { deriveConnectionState } = require("./onboarding-trust");

const FIRST_WORKFLOW_ID = "deadline-awareness-v1";
const REQUIRED_CAPABILITIES = Object.freeze(["mail.search", "mail.read", "calendar.read"]);

function requiredObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function assertActiveTenantProfile(profile) {
  requiredObject(profile, "profile");
  if (profile.deletedAt) throw new Error("onboarding profile is deleted");
  if (!String(profile.tenantId || "").trim()) throw new Error("profile.tenantId is required");
  if (!String(profile.userId || "").trim()) throw new Error("profile.userId is required");
  if (!profile.answers || !profile.recommendations) {
    throw new Error("completed onboarding context is required");
  }
}

function indexCapabilities(registry) {
  requiredObject(registry, "registry");
  if (!Array.isArray(registry.capabilities)) throw new Error("registry.capabilities must be an array");
  return new Map(registry.capabilities.map((entry) => [entry.capability_id, entry]));
}

function supportsDeadlineAwareness(profile) {
  return Array.isArray(profile.answers.desiredOutcomes) &&
    profile.answers.desiredOutcomes.includes("deadline_awareness");
}

function authoritativeProductivityConnection(backendEvidence) {
  const evidence = backendEvidence && typeof backendEvidence === "object" ? backendEvidence : null;
  const state = deriveConnectionState({ backendEvidence: evidence });
  return {
    state,
    ready: state === "connected" || state === "verified",
  };
}

/**
 * Deterministically select the smallest useful post-onboarding workflow.
 *
 * V1 is intentionally narrow: deadline awareness uses only read capabilities
 * and produces a preview plan. It never executes connector actions here.
 * Client-reported connection state is deliberately ignored; only backend
 * authorization evidence can make the plan executable.
 */
function planFirstUsefulWorkflow({ profile, registry, backendEvidence = null } = {}) {
  assertActiveTenantProfile(profile);
  const capabilities = indexCapabilities(registry);

  if (!supportsDeadlineAwareness(profile)) {
    return {
      status: "no_supported_first_workflow",
      workflowId: null,
      tenantId: profile.tenantId,
      reason: "deadline_awareness_not_selected",
      executable: false,
      previewOnly: true,
      requiredCapabilities: [],
    };
  }

  const missing = REQUIRED_CAPABILITIES.filter((id) => !capabilities.has(id));
  if (missing.length) {
    return {
      status: "blocked",
      workflowId: FIRST_WORKFLOW_ID,
      tenantId: profile.tenantId,
      reason: "capability_registry_incomplete",
      executable: false,
      previewOnly: true,
      missingCapabilities: missing,
      requiredCapabilities: [...REQUIRED_CAPABILITIES],
    };
  }

  const unsafe = REQUIRED_CAPABILITIES.filter((id) => {
    const capability = capabilities.get(id);
    return capability.risk_level !== "read" || capability.default_execution_policy !== "read_only";
  });
  if (unsafe.length) {
    return {
      status: "blocked",
      workflowId: FIRST_WORKFLOW_ID,
      tenantId: profile.tenantId,
      reason: "capability_contract_not_read_only",
      executable: false,
      previewOnly: true,
      unsafeCapabilities: unsafe,
      requiredCapabilities: [...REQUIRED_CAPABILITIES],
    };
  }

  const connection = authoritativeProductivityConnection(backendEvidence);
  const policyContract = profile.recommendations.policyContract || {};

  return {
    status: connection.ready ? "ready_for_preview" : "connection_required",
    workflowId: FIRST_WORKFLOW_ID,
    workflowVersion: 1,
    tenantId: profile.tenantId,
    userId: profile.userId,
    outcomeId: "deadline_awareness",
    providerId: "openrabbit_productivity",
    connectionState: connection.state,
    executable: connection.ready,
    previewOnly: true,
    requiredCapabilities: [...REQUIRED_CAPABILITIES],
    policyId: String(policyContract.policyId || "onboarding-review-first-v1"),
    executionBoundary: "governed_workflow_required",
    verificationBoundary: "independent_backend_evidence_required",
  };
}

function recordFirstWorkflowPreview({ plan, activationTracker, occurredAt = new Date() } = {}) {
  requiredObject(plan, "plan");
  if (!activationTracker || typeof activationTracker.recordPreview !== "function") {
    throw new Error("activationTracker with recordPreview() is required");
  }
  if (plan.status !== "ready_for_preview" || !plan.executable) {
    throw new Error("workflow preview cannot be recorded until trusted connection evidence is ready");
  }
  return activationTracker.recordPreview({ occurredAt, informationState: "simulated_preview" });
}

module.exports = {
  FIRST_WORKFLOW_ID,
  REQUIRED_CAPABILITIES,
  planFirstUsefulWorkflow,
  recordFirstWorkflowPreview,
};
