import { describe, expect, it } from "vitest";

import {
  recommendAdaptiveOnboardingPreview,
  resetAdaptiveOnboardingProfile,
} from "../../src/core/adaptive-onboarding.js";
import type { AdaptiveOnboardingProfile } from "../../src/interfaces/adaptive-onboarding.js";

function profile(
  overrides: Partial<AdaptiveOnboardingProfile> = {},
): AdaptiveOnboardingProfile {
  return {
    version: "openrabbit.onboarding.v1",
    primaryWorkArea: "real_estate",
    secondaryWorkAreas: [],
    desiredOutcomes: ["lead_deal_movement"],
    existingTools: ["Gmail", "HubSpot"],
    startingState: "improve_existing",
    presentationPreferences: ["pipeline_first"],
    authorityProfile: "review_first",
    currentStep: 6,
    previewSeen: false,
    ...overrides,
  };
}

describe("adaptive onboarding preview", () => {
  it("is reachable without connecting a private provider and is unmistakably simulated", () => {
    const preview = recommendAdaptiveOnboardingPreview(profile());

    expect(preview.informationState).toBe("simulated_preview");
    expect(preview.privateProviderRequired).toBe(false);
    expect(preview.connectionPlan).toEqual([
      expect.objectContaining({ provider: "gmail", state: "ready_to_connect", requestedNow: false }),
      expect.objectContaining({ provider: "hubspot", state: "ready_to_connect", requestedNow: false }),
    ]);
  });

  it("makes each consequential Phase-2 question observable downstream", () => {
    const baseline = recommendAdaptiveOnboardingPreview(profile());

    const workArea = recommendAdaptiveOnboardingPreview(
      profile({ primaryWorkArea: "city_public_service" }),
    );
    expect(workArea.recommendedIndustryPack).not.toBe(baseline.recommendedIndustryPack);
    expect(workArea.decisionTrace.workArea).not.toBe(baseline.decisionTrace.workArea);

    const outcome = recommendAdaptiveOnboardingPreview(
      profile({ desiredOutcomes: ["decision_preparation"] }),
    );
    expect(outcome.primaryWorkflow).not.toBe(baseline.primaryWorkflow);
    expect(outcome.decisionTrace.desiredOutcomes).not.toBe(
      baseline.decisionTrace.desiredOutcomes,
    );

    const tools = recommendAdaptiveOnboardingPreview(
      profile({ existingTools: ["Google Calendar"] }),
    );
    expect(tools.connectionPlan).not.toEqual(baseline.connectionPlan);
    expect(tools.decisionTrace.existingTools).not.toBe(baseline.decisionTrace.existingTools);

    const startingState = recommendAdaptiveOnboardingPreview(
      profile({ startingState: "create_new" }),
    );
    expect(startingState.workspaceLayout).not.toEqual(baseline.workspaceLayout);
    expect(startingState.decisionTrace.startingState).not.toBe(
      baseline.decisionTrace.startingState,
    );

    const presentation = recommendAdaptiveOnboardingPreview(
      profile({ presentationPreferences: ["map_first"] }),
    );
    expect(presentation.workspaceLayout[0]).toBe("map");
    expect(presentation.decisionTrace.presentationPreferences).not.toBe(
      baseline.decisionTrace.presentationPreferences,
    );
  });

  it("normalizes duplicate tool inventory without escalating authority", () => {
    const preview = recommendAdaptiveOnboardingPreview(
      profile({ existingTools: [" Gmail ", "gmail", "HubSpot"] }),
    );

    expect(preview.connectionPlan.map((item) => item.provider)).toEqual(["gmail", "hubspot"]);
    expect(preview.connectionPlan.every((item) => item.requestedNow === false)).toBe(true);
    expect(preview.authorityProfile).toBe("review_first");
  });

  it("rejects incomplete or over-specified preview profiles", () => {
    expect(() =>
      recommendAdaptiveOnboardingPreview(profile({ desiredOutcomes: [] })),
    ).toThrow("at least one desired outcome");
    expect(() =>
      recommendAdaptiveOnboardingPreview(
        profile({
          presentationPreferences: [
            "calendar_first",
            "communications_first",
            "pipeline_first",
            "map_first",
          ],
        }),
      ),
    ).toThrow("at most three presentation preferences");
  });

  it("provides a neutral reset state with review-first authority", () => {
    expect(resetAdaptiveOnboardingProfile()).toEqual(
      expect.objectContaining({
        version: "openrabbit.onboarding.v1",
        primaryWorkArea: "configure_with_ai",
        authorityProfile: "review_first",
        previewSeen: false,
        currentStep: 1,
      }),
    );
  });
});
