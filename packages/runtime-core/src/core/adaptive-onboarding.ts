import type {
  AdaptiveOnboardingPreview,
  AdaptiveOnboardingProfile,
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
