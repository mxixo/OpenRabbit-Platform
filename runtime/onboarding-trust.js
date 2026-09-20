"use strict";

const SCHEMA_VERSION = 1;

const WORK_AREAS = Object.freeze([
  "real_estate",
  "business",
  "city_public_service",
  "personal",
  "configure_with_ai",
]);
const DESIRED_OUTCOMES = Object.freeze([
  "deadline_awareness",
  "lead_deal_movement",
  "decision_preparation",
  "content_outreach",
  "cross_device_operation",
]);
const STARTING_STATES = Object.freeze(["improve_existing", "create_new", "both"]);
const AUTHORITY_PROFILES = Object.freeze(["review_first", "assist_automatically", "custom"]);
const CONNECTION_STATES = Object.freeze([
  "available",
  "ready_to_connect",
  "authorization_in_progress",
  "connected",
  "verified",
  "needs_attention",
  "unavailable",
]);
const ACTION_STATES = Object.freeze([
  "proposed",
  "approved",
  "executing",
  "completed",
  "failed",
  "verified",
  "rejected",
]);
const INFORMATION_STATES = Object.freeze([
  "simulated_preview",
  "live",
  "last_updated",
  "stale",
  "unavailable",
]);

const QUESTION_EFFECTS = Object.freeze({
  primaryWorkArea: Object.freeze(["recommendedIndustryPack", "workspaceLayout"]),
  secondaryWorkAreas: Object.freeze(["workspaceModules"]),
  desiredOutcomes: Object.freeze(["workspaceModules", "recommendedConnectionPlan"]),
  existingTools: Object.freeze(["recommendedConnectionPlan"]),
  startingState: Object.freeze(["firstWorkflowMode"]),
  presentationPreferenceIds: Object.freeze(["workspaceLayout"]),
  authorityProfile: Object.freeze(["policyContract"]),
});

const INDUSTRY_PACK_BY_WORK_AREA = Object.freeze({
  real_estate: "real-estate",
  business: "business",
  city_public_service: "public-service",
  personal: "personal",
  configure_with_ai: "general",
});

const MODULE_BY_OUTCOME = Object.freeze({
  deadline_awareness: "calendar",
  lead_deal_movement: "crm",
  decision_preparation: "briefing",
  content_outreach: "social",
  cross_device_operation: "nodes",
});

const TOOL_CONNECTION_CATALOG = Object.freeze({
  gmail: Object.freeze({ provider: "google", capability: "email", access: "read_write" }),
  google_calendar: Object.freeze({ provider: "google", capability: "calendar", access: "read_write" }),
  hubspot: Object.freeze({ provider: "hubspot", capability: "crm", access: "read_write" }),
  google_drive: Object.freeze({ provider: "google", capability: "files", access: "read_only" }),
  slack: Object.freeze({ provider: "slack", capability: "messaging", access: "read_write" }),
  github: Object.freeze({ provider: "github", capability: "development", access: "read_write" }),
});

const AUTHORITY_POLICY_CONTRACTS = Object.freeze({
  review_first: Object.freeze({
    policyId: "onboarding-review-first-v1",
    defaultRead: "allow_after_connection",
    defaultWrite: "require_approval",
    destructiveWrite: "require_approval",
  }),
  assist_automatically: Object.freeze({
    policyId: "onboarding-assist-automatically-v1",
    defaultRead: "allow_after_connection",
    defaultWrite: "allow_bounded_low_risk",
    destructiveWrite: "require_approval",
  }),
  custom: Object.freeze({
    policyId: "onboarding-custom-v1",
    defaultRead: "explicit_rule_required",
    defaultWrite: "explicit_rule_required",
    destructiveWrite: "require_approval",
  }),
});

const TRUST_EVENT_NAMES = Object.freeze([
  "onboarding_started",
  "onboarding_step_completed",
  "preview_viewed",
  "connection_started",
  "connection_state_changed",
  "permission_explanation_viewed",
  "authority_profile_selected",
  "first_verified_connection",
  "first_verified_win",
  "connection_failed",
  "connection_recovered",
  "onboarding_reset",
  "onboarding_exported",
  "onboarding_deleted",
]);

const TRUST_EVENT_ALLOWED_FIELDS = Object.freeze([
  "schemaVersion",
  "tenantId",
  "userId",
  "sessionId",
  "stepId",
  "providerId",
  "capabilityId",
  "connectionState",
  "actionState",
  "informationState",
  "authorityProfile",
  "workArea",
  "outcomeId",
  "durationMs",
  "success",
  "errorCode",
  "occurredAt",
]);

const FORBIDDEN_ANALYTICS_KEY_PATTERN = /(content|body|message|prompt|token|secret|password|authorization|cookie|credential|email_address|phone|file_text)/i;

function assertEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
}

function uniqueCategorical(values, allowed, field) {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  const unique = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  for (const value of unique) assertEnum(value, allowed, field);
  return unique;
}

function normalizeToolIds(values) {
  if (!Array.isArray(values)) throw new Error("existingTools must be an array");
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))].sort();
}

function deterministicRecommendations(answers) {
  const primaryWorkArea = answers.primaryWorkArea;
  assertEnum(primaryWorkArea, WORK_AREAS, "primaryWorkArea");
  const desiredOutcomes = uniqueCategorical(answers.desiredOutcomes || [], DESIRED_OUTCOMES, "desiredOutcomes");
  const existingTools = normalizeToolIds(answers.existingTools || []);
  const authorityProfile = answers.authorityProfile || "review_first";
  assertEnum(authorityProfile, AUTHORITY_PROFILES, "authorityProfile");

  const modules = [...new Set(desiredOutcomes.map((outcome) => MODULE_BY_OUTCOME[outcome]).filter(Boolean))];
  const presentationPreferenceIds = Array.isArray(answers.presentationPreferenceIds)
    ? [...new Set(answers.presentationPreferenceIds.map(String).filter(Boolean))]
    : [];

  const connectionPlan = existingTools
    .filter((toolId) => Object.prototype.hasOwnProperty.call(TOOL_CONNECTION_CATALOG, toolId))
    .map((toolId) => ({ toolId, ...TOOL_CONNECTION_CATALOG[toolId] }));

  return {
    recommendedIndustryPack: INDUSTRY_PACK_BY_WORK_AREA[primaryWorkArea],
    workspaceLayout: presentationPreferenceIds[0] || `${primaryWorkArea}-default-v1`,
    workspaceModules: modules,
    recommendedConnectionPlan: connectionPlan,
    firstWorkflowMode: answers.startingState || "both",
    policyContract: { ...AUTHORITY_POLICY_CONTRACTS[authorityProfile] },
  };
}

function createOnboardingProfile(input, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("profile input is required");
  const tenantId = String(input.tenantId || "").trim();
  const userId = String(input.userId || "").trim();
  if (!tenantId) throw new Error("tenantId is required");
  if (!userId) throw new Error("userId is required");

  const answers = {
    primaryWorkArea: input.primaryWorkArea,
    secondaryWorkAreas: uniqueCategorical(input.secondaryWorkAreas || [], WORK_AREAS, "secondaryWorkAreas"),
    desiredOutcomes: uniqueCategorical(input.desiredOutcomes || [], DESIRED_OUTCOMES, "desiredOutcomes"),
    existingTools: normalizeToolIds(input.existingTools || []),
    startingState: input.startingState || "both",
    presentationPreferenceIds: Array.isArray(input.presentationPreferenceIds)
      ? [...new Set(input.presentationPreferenceIds.map(String).filter(Boolean))]
      : [],
    authorityProfile: input.authorityProfile || "review_first",
  };
  assertEnum(answers.primaryWorkArea, WORK_AREAS, "primaryWorkArea");
  assertEnum(answers.startingState, STARTING_STATES, "startingState");
  assertEnum(answers.authorityProfile, AUTHORITY_PROFILES, "authorityProfile");

  const timestamp = new Date(now).toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId,
    userId,
    revision: 1,
    currentStep: String(input.currentStep || "personalized_preview"),
    completedSteps: Array.isArray(input.completedSteps) ? [...new Set(input.completedSteps.map(String))] : [],
    answers,
    recommendations: deterministicRecommendations(answers),
    previewState: INFORMATION_STATES.includes(input.previewState) ? input.previewState : "simulated_preview",
    firstWinState: input.firstWinState || "not_started",
    createdAt: timestamp,
    updatedAt: timestamp,
    resetAt: null,
    deletedAt: null,
  };
}

function revisitOnboardingProfile(profile, patch, now = new Date()) {
  assertActiveProfile(profile);
  const answers = { ...profile.answers, ...(patch.answers || {}) };
  const candidate = createOnboardingProfile(
    {
      tenantId: profile.tenantId,
      userId: profile.userId,
      ...answers,
      currentStep: patch.currentStep || profile.currentStep,
      completedSteps: patch.completedSteps || profile.completedSteps,
      previewState: patch.previewState || profile.previewState,
      firstWinState: patch.firstWinState || profile.firstWinState,
    },
    now
  );
  return {
    ...candidate,
    createdAt: profile.createdAt,
    revision: Number(profile.revision || 0) + 1,
  };
}

function resetOnboardingProfile(profile, now = new Date()) {
  assertActiveProfile(profile);
  const timestamp = new Date(now).toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId: profile.tenantId,
    userId: profile.userId,
    revision: Number(profile.revision || 0) + 1,
    currentStep: "work_identity",
    completedSteps: [],
    answers: null,
    recommendations: null,
    previewState: "simulated_preview",
    firstWinState: "not_started",
    createdAt: profile.createdAt,
    updatedAt: timestamp,
    resetAt: timestamp,
    deletedAt: null,
  };
}

function exportOnboardingProfile(profile) {
  assertActiveProfile(profile);
  return JSON.parse(JSON.stringify(profile));
}

function deleteOnboardingProfile(profile, now = new Date()) {
  if (!profile || typeof profile !== "object") throw new Error("profile is required");
  const timestamp = new Date(now).toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId: profile.tenantId,
    userId: profile.userId,
    revision: Number(profile.revision || 0) + 1,
    deletedAt: timestamp,
  };
}

function assertActiveProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("profile is required");
  if (profile.deletedAt) throw new Error("onboarding profile is deleted");
}

function deriveConnectionState({ available = true, authorizationInProgress = false, backendEvidence = null, needsAttention = false } = {}) {
  if (!available) return "unavailable";
  if (needsAttention) return "needs_attention";
  const evidence = backendEvidence && typeof backendEvidence === "object" ? backendEvidence : {};
  if (evidence.verifiedAt && evidence.providerAccountId && evidence.verificationId) return "verified";
  if (evidence.authorizedAt && evidence.providerAccountId) return "connected";
  if (authorizationInProgress) return "authorization_in_progress";
  return "ready_to_connect";
}

function connectionTruth({ networkReachable = false, backendEvidence = null, capabilityAuthority = null } = {}) {
  return {
    networkReachable: Boolean(networkReachable),
    connectionState: deriveConnectionState({ backendEvidence }),
    capabilityAuthority: capabilityAuthority
      ? {
          read: Boolean(capabilityAuthority.read),
          write: Boolean(capabilityAuthority.write),
          destructiveWrite: Boolean(capabilityAuthority.destructiveWrite),
        }
      : { read: false, write: false, destructiveWrite: false },
  };
}

function permissionExplanation({ capability, requestedAccess, willDo, willNotDo, reasonNow, disconnectPath }) {
  const required = { capability, requestedAccess, willDo, willNotDo, reasonNow, disconnectPath };
  for (const [key, value] of Object.entries(required)) {
    if (!String(value || "").trim()) throw new Error(`${key} is required`);
  }
  if (!['read_only', 'read_write'].includes(requestedAccess)) {
    throw new Error("requestedAccess must be read_only or read_write");
  }
  return {
    capability: String(capability),
    requestedAccess,
    writeAuthority: requestedAccess === "read_write",
    willDo: String(willDo),
    willNotDo: String(willNotDo),
    reasonNow: String(reasonNow),
    disconnectPath: String(disconnectPath),
  };
}

function buildTrustEvent(eventName, payload = {}) {
  assertEnum(eventName, TRUST_EVENT_NAMES, "eventName");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("analytics payload must be an object");
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_ANALYTICS_KEY_PATTERN.test(key)) {
      throw new Error(`analytics field is forbidden: ${key}`);
    }
    if (!TRUST_EVENT_ALLOWED_FIELDS.includes(key)) {
      throw new Error(`analytics field is not allowlisted: ${key}`);
    }
  }
  const event = { eventName };
  for (const key of TRUST_EVENT_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) event[key] = payload[key];
  }
  event.schemaVersion = SCHEMA_VERSION;
  return event;
}

module.exports = {
  SCHEMA_VERSION,
  WORK_AREAS,
  DESIRED_OUTCOMES,
  STARTING_STATES,
  AUTHORITY_PROFILES,
  CONNECTION_STATES,
  ACTION_STATES,
  INFORMATION_STATES,
  QUESTION_EFFECTS,
  AUTHORITY_POLICY_CONTRACTS,
  TRUST_EVENT_NAMES,
  TRUST_EVENT_ALLOWED_FIELDS,
  deterministicRecommendations,
  createOnboardingProfile,
  revisitOnboardingProfile,
  resetOnboardingProfile,
  exportOnboardingProfile,
  deleteOnboardingProfile,
  deriveConnectionState,
  connectionTruth,
  permissionExplanation,
  buildTrustEvent,
};
