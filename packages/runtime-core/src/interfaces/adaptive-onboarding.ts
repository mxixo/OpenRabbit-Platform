export type OnboardingWorkArea =
  | "real_estate"
  | "business"
  | "city_public_service"
  | "personal"
  | "configure_with_ai";

export type OnboardingOutcome =
  | "deadline_awareness"
  | "lead_deal_movement"
  | "decision_preparation"
  | "content_outreach"
  | "cross_device_operation";

export type OnboardingStartingState = "improve_existing" | "create_new" | "both";

export type OnboardingPresentationPreference =
  | "calendar_first"
  | "communications_first"
  | "pipeline_first"
  | "map_first"
  | "compact"
  | "guided";

export type OnboardingAuthorityProfile = "review_first" | "assist_automatically" | "custom";

export interface AdaptiveOnboardingProfile {
  version: "openrabbit.onboarding.v1";
  primaryWorkArea: OnboardingWorkArea;
  secondaryWorkAreas: OnboardingWorkArea[];
  desiredOutcomes: OnboardingOutcome[];
  existingTools: string[];
  startingState: OnboardingStartingState;
  presentationPreferences: OnboardingPresentationPreference[];
  authorityProfile: OnboardingAuthorityProfile;
  currentStep: number;
  previewSeen: boolean;
}

export interface OnboardingConnectionRecommendation {
  provider: string;
  state: "ready_to_connect";
  requestedNow: false;
  reason: string;
}

export interface AdaptiveOnboardingPreview {
  informationState: "simulated_preview";
  privateProviderRequired: false;
  recommendedIndustryPack: string;
  workspaceLayout: string[];
  primaryWorkflow: string;
  connectionPlan: OnboardingConnectionRecommendation[];
  authorityProfile: OnboardingAuthorityProfile;
  decisionTrace: {
    workArea: string;
    desiredOutcomes: string;
    existingTools: string;
    startingState: string;
    presentationPreferences: string;
  };
}
