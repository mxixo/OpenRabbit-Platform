import { describe, expect, it } from "vitest";

import {
  ADAPTIVE_ONBOARDING_DRAFT_KEY,
  restoreAdaptiveOnboardingDraft,
  serializeAdaptiveOnboardingDraft,
} from "../../src/core/adaptive-onboarding.js";
import type { AdaptiveOnboardingProfile } from "../../src/interfaces/adaptive-onboarding.js";

const draft: AdaptiveOnboardingProfile = {
  version: "openrabbit.onboarding.v1",
  primaryWorkArea: "real_estate",
  secondaryWorkAreas: ["business"],
  desiredOutcomes: ["lead_deal_movement", "deadline_awareness"],
  existingTools: [" Gmail ", "HubSpot", "gmail"],
  startingState: "improve_existing",
  presentationPreferences: ["pipeline_first", "compact"],
  authorityProfile: "review_first",
  currentStep: 4,
  previewSeen: false,
};

describe("adaptive onboarding resume contract", () => {
  it("round-trips bounded choices while normalizing non-authoritative tool labels", () => {
    const encoded = serializeAdaptiveOnboardingDraft(draft);
    const restored = restoreAdaptiveOnboardingDraft(encoded);

    expect(ADAPTIVE_ONBOARDING_DRAFT_KEY).toBe("openrabbit.onboarding.v1.draft");
    expect(restored).toEqual({
      ...draft,
      existingTools: ["gmail", "hubspot"],
    });
  });

  it("fails closed on future versions, extra fields, and invalid step positions", () => {
    expect(() =>
      restoreAdaptiveOnboardingDraft({ ...draft, version: "openrabbit.onboarding.v2" }),
    ).toThrow("unsupported onboarding draft version");

    expect(() =>
      restoreAdaptiveOnboardingDraft({ ...draft, providerToken: "must-not-persist" }),
    ).toThrow("unsupported field set");

    expect(() => restoreAdaptiveOnboardingDraft({ ...draft, currentStep: 99 })).toThrow(
      "outside the supported onboarding flow",
    );
  });

  it("does not allow resume payloads to silently widen authority or presentation choices", () => {
    expect(() =>
      restoreAdaptiveOnboardingDraft({ ...draft, authorityProfile: "full_autonomy" }),
    ).toThrow("authorityProfile is unsupported");

    expect(() =>
      restoreAdaptiveOnboardingDraft({
        ...draft,
        presentationPreferences: [
          "calendar_first",
          "communications_first",
          "pipeline_first",
          "map_first",
        ],
      }),
    ).toThrow("at most three presentation preferences");
  });
});
