import type {
  AdaptiveOnboardingPreview,
  AdaptiveOnboardingProfile,
  OnboardingAuthorityProfile,
  OnboardingOutcome,
  OnboardingPresentationPreference,
  OnboardingStartingState,
  OnboardingWorkArea,
} from "../interfaces/adaptive-onboarding.js";

const WORK_AREA_PACKS: Record<OnboardingWorkArea, string> = {
  real_estate: "real-estate",
  business: "business-operations",
  city_public_service: "public-service",
  personal: "personal-command-center",
  configure_with_ai: "adaptive-general",
};

const WORK_AREA_WIDGETS: Record<OnboardingWorkArea, string[]> = {
  real_estate: ["calendar", "communications", "crm", "map"],
  business: ["calendar", "communications", "projects", "crm"],
  city_public_service: ["calendar", "communications", "agenda", "constituent-work"],
  personal: ["calendar", "tasks", "communications", "goals"],
  configure_with_ai: ["calendar", "communications", "tasks", "assistant"],
};

const OUTCOME_WORKFLOWS: Record<OnboardingOutcome, string> = {
  deadline_awareness: "surface deadlines and prepare the next action",
  lead_deal_movement: "move the highest-priority lead or deal forward",
  decision_preparation: "prepare a decision brief with evidence and open questions",
  content_outreach: "prepare prioritized outreach with approval before sending",
  cross_device_operation: "continue a bounded workflow across available devices",
};

const OUTCOME_WIDGETS: Record<OnboardingOutcome, string> = {
  deadline_awareness: "deadline-radar",
  lead_deal_movement: "pipeline",
  decision_preparation: "decision-brief",
  content_outreach: "outreach-queue",
  cross_device_operation: "device-status",
};

const PRESENTATION_WIDGETS: Record<OnboardingPresentationPreference, string> = {
  calendar_first: "calendar",
  communications_first: "communications",
  pipeline_first: "pipeline",
  map_first: "map",
  compact: "compact-summary",
  guided: "guided-next-action",
};

const WORK_AREAS = new Set<OnboardingWorkArea>(Object.keys(WORK_AREA_PACKS) as OnboardingWorkArea[]);
const OUTCOMES = new Set<OnboardingOutcome>(Object.keys(OUTCOME_WORKFLOWS) as OnboardingOutcome[]);
const PRESENTATION_PREFERENCES = new Set<OnboardingPresentationPreference>(
  Object.keys(PRESENTATION_WIDGETS) as OnboardingPresentationPreference[],
);
const STARTING_STATES = new Set<OnboardingStartingState>(["improve_existing", "create_new", "both"]);
const AUTHORITY_PROFILES = new Set<OnboardingAuthorityProfile>([
  "review_first",
  "assist_automatically",
  "custom",
]);

export const ADAPTIVE_ONBOARDING_DRAFT_KEY = "openrabbit.onboarding.v1.draft";
export const ADAPTIVE_ONBOARDING_MAX_STEP = 6;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeTools(values: string[]): string[] {
  return unique(
    values
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  ).sort();
}

function toolReason(tool: string): string {
  return `Use ${tool} only after the user chooses the capability that needs it.`;
}

function startingStateWidget(startingState: OnboardingStartingState): string {
  switch (startingState) {
    case "improve_existing":
      return "existing-workspace-review";
    case "create_new":
      return "workspace-setup";
    case "both":
      return "migration-and-setup";
  }
}

function preferenceLayout(
  preferences: OnboardingPresentationPreference[],
  widgets: string[],
): string[] {
  const preferred = preferences.map((preference) => PRESENTATION_WIDGETS[preference]);
  return unique([...preferred, ...widgets]);
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be a string array`);
  }
  return value;
}

function requireEnumArray<T extends string>(
  value: unknown,
  allowed: Set<T>,
  field: string,
): T[] {
  const values = requireStringArray(value, field);
  if (values.some((item) => !allowed.has(item as T))) {
    throw new Error(`${field} contains an unsupported value`);
  }
  return values as T[];
}

/**
 * Build a deterministic, provider-free onboarding preview.
 *
 * This function never authorizes a provider, upgrades a connection state, or
 * labels simulated information as live. Each Phase-2 answer is deliberately
 * reflected in either layout, workflow, connection plan, or decisionTrace so
 * the UI can prove that the question was consequential.
 */
export function recommendAdaptiveOnboardingPreview(
  profile: AdaptiveOnboardingProfile,
): AdaptiveOnboardingPreview {
  if (profile.version !== "openrabbit.onboarding.v1") {
    throw new Error("unsupported onboarding profile version");
  }
  if (profile.desiredOutcomes.length === 0) {
    throw new Error("at least one desired outcome is required for preview");
  }
  if (profile.presentationPreferences.length > 3) {
    throw new Error("at most three presentation preferences are allowed");
  }

  const tools = normalizeTools(profile.existingTools);
  const primaryOutcome = profile.desiredOutcomes[0];
  const workAreaWidgets = WORK_AREA_WIDGETS[profile.primaryWorkArea];
  const outcomeWidgets = profile.desiredOutcomes.map((outcome) => OUTCOME_WIDGETS[outcome]);
  const layout = preferenceLayout(profile.presentationPreferences, [
    ...workAreaWidgets,
    ...outcomeWidgets,
    startingStateWidget(profile.startingState),
  ]);

  return {
    informationState: "simulated_preview",
    privateProviderRequired: false,
    recommendedIndustryPack: WORK_AREA_PACKS[profile.primaryWorkArea],
    workspaceLayout: layout,
    primaryWorkflow: OUTCOME_WORKFLOWS[primaryOutcome],
    connectionPlan: tools.map((provider) => ({
      provider,
      state: "ready_to_connect",
      requestedNow: false,
      reason: toolReason(provider),
    })),
    authorityProfile: profile.authorityProfile,
    decisionTrace: {
      workArea: `pack=${WORK_AREA_PACKS[profile.primaryWorkArea]}; widgets=${workAreaWidgets.join(",")}`,
      desiredOutcomes: `workflow=${OUTCOME_WORKFLOWS[primaryOutcome]}; widgets=${outcomeWidgets.join(",")}`,
      existingTools: tools.length > 0 ? `connection-plan=${tools.join(",")}` : "connection-plan=none",
      startingState: `workspace-mode=${startingStateWidget(profile.startingState)}`,
      presentationPreferences:
        profile.presentationPreferences.length > 0
          ? `priority=${profile.presentationPreferences.join(",")}`
          : "priority=default",
    },
  };
}

/**
 * Serialize only the bounded onboarding answers needed to resume the flow.
 * Provider credentials, provider data, and generated preview contents are not
 * part of the profile contract and therefore cannot enter the draft payload.
 */
export function serializeAdaptiveOnboardingDraft(profile: AdaptiveOnboardingProfile): string {
  const restored = restoreAdaptiveOnboardingDraft(profile);
  return JSON.stringify(restored);
}

/**
 * Restore a versioned onboarding draft from JSON or an already-parsed value.
 * Invalid, future-version, or over-broad drafts fail closed instead of silently
 * changing authority, step position, or presentation choices.
 */
export function restoreAdaptiveOnboardingDraft(raw: string | unknown): AdaptiveOnboardingProfile {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("onboarding draft is not valid JSON");
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("onboarding draft must be an object");
  }

  const draft = value as Record<string, unknown>;
  const expectedKeys = [
    "version",
    "primaryWorkArea",
    "secondaryWorkAreas",
    "desiredOutcomes",
    "existingTools",
    "startingState",
    "presentationPreferences",
    "authorityProfile",
    "currentStep",
    "previewSeen",
  ];
  const actualKeys = Object.keys(draft).sort();
  if (actualKeys.join("|") !== [...expectedKeys].sort().join("|")) {
    throw new Error("onboarding draft contains an unsupported field set");
  }
  if (draft.version !== "openrabbit.onboarding.v1") {
    throw new Error("unsupported onboarding draft version");
  }
  if (typeof draft.primaryWorkArea !== "string" || !WORK_AREAS.has(draft.primaryWorkArea as OnboardingWorkArea)) {
    throw new Error("primaryWorkArea is unsupported");
  }
  const secondaryWorkAreas = requireEnumArray(
    draft.secondaryWorkAreas,
    WORK_AREAS,
    "secondaryWorkAreas",
  );
  const desiredOutcomes = requireEnumArray(draft.desiredOutcomes, OUTCOMES, "desiredOutcomes");
  if (desiredOutcomes.length === 0) {
    throw new Error("at least one desired outcome is required");
  }
  const existingTools = normalizeTools(requireStringArray(draft.existingTools, "existingTools"));
  if (typeof draft.startingState !== "string" || !STARTING_STATES.has(draft.startingState as OnboardingStartingState)) {
    throw new Error("startingState is unsupported");
  }
  const presentationPreferences = requireEnumArray(
    draft.presentationPreferences,
    PRESENTATION_PREFERENCES,
    "presentationPreferences",
  );
  if (presentationPreferences.length > 3) {
    throw new Error("at most three presentation preferences are allowed");
  }
  if (typeof draft.authorityProfile !== "string" || !AUTHORITY_PROFILES.has(draft.authorityProfile as OnboardingAuthorityProfile)) {
    throw new Error("authorityProfile is unsupported");
  }
  if (
    typeof draft.currentStep !== "number" ||
    !Number.isInteger(draft.currentStep) ||
    draft.currentStep < 1 ||
    draft.currentStep > ADAPTIVE_ONBOARDING_MAX_STEP
  ) {
    throw new Error("currentStep is outside the supported onboarding flow");
  }
  if (typeof draft.previewSeen !== "boolean") {
    throw new Error("previewSeen must be boolean");
  }

  return {
    version: "openrabbit.onboarding.v1",
    primaryWorkArea: draft.primaryWorkArea as OnboardingWorkArea,
    secondaryWorkAreas: unique(secondaryWorkAreas) as OnboardingWorkArea[],
    desiredOutcomes: unique(desiredOutcomes) as OnboardingOutcome[],
    existingTools,
    startingState: draft.startingState as OnboardingStartingState,
    presentationPreferences: unique(presentationPreferences) as OnboardingPresentationPreference[],
    authorityProfile: draft.authorityProfile as OnboardingAuthorityProfile,
    currentStep: draft.currentStep,
    previewSeen: draft.previewSeen,
  };
}

export function resetAdaptiveOnboardingProfile(): AdaptiveOnboardingProfile {
  return {
    version: "openrabbit.onboarding.v1",
    primaryWorkArea: "configure_with_ai",
    secondaryWorkAreas: [],
    desiredOutcomes: ["deadline_awareness"],
    existingTools: [],
    startingState: "create_new",
    presentationPreferences: [],
    authorityProfile: "review_first",
    currentStep: 1,
    previewSeen: false,
  };
}
