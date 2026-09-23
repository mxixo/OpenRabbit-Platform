import { describe, expect, it } from "vitest";

import { verifyProductionProjectBoundary } from "../../src/core/production-project-boundary.js";

const OPENRABBIT_REF = "djplmhglilcwqfotnjew";
const WAYGO_REF = "zwrsapkgdfsvvaoefhqf";

describe("verifyProductionProjectBoundary", () => {
  it("accepts only the explicitly designated canonical project origin", () => {
    expect(
      verifyProductionProjectBoundary({
        product: "openrabbit",
        environment: "production",
        provider: "supabase",
        expectedProjectRef: OPENRABBIT_REF,
        projectUrl: `https://${OPENRABBIT_REF}.supabase.co`,
      }),
    ).toEqual({
      product: "openrabbit",
      environment: "production",
      provider: "supabase",
      projectRef: OPENRABBIT_REF,
      projectUrl: `https://${OPENRABBIT_REF}.supabase.co`,
    });
  });

  it("fails closed if a different product project is substituted", () => {
    expect(() =>
      verifyProductionProjectBoundary({
        product: "openrabbit",
        environment: "production",
        provider: "supabase",
        expectedProjectRef: OPENRABBIT_REF,
        projectUrl: `https://${WAYGO_REF}.supabase.co`,
      }),
    ).toThrow(/does not match/);
  });

  it.each([
    "",
    "not-a-project-ref",
    "ZWRSAPKGDFSVVAOEFHQF-extra",
  ])("rejects a non-canonical explicit project ref: %s", (expectedProjectRef) => {
    expect(() =>
      verifyProductionProjectBoundary({
        product: "openrabbit",
        environment: "production",
        provider: "supabase",
        expectedProjectRef,
        projectUrl: `https://${OPENRABBIT_REF}.supabase.co`,
      }),
    ).toThrow(/project ref/);
  });

  it.each([
    `http://${OPENRABBIT_REF}.supabase.co`,
    `https://${OPENRABBIT_REF}.supabase.co/path`,
    `https://${OPENRABBIT_REF}.supabase.co?redirect=1`,
    `https://${OPENRABBIT_REF}.supabase.co#fragment`,
    `https://user:pass@${OPENRABBIT_REF}.supabase.co`,
  ])("rejects a non-canonical production origin: %s", (projectUrl) => {
    expect(() =>
      verifyProductionProjectBoundary({
        product: "openrabbit",
        environment: "production",
        provider: "supabase",
        expectedProjectRef: OPENRABBIT_REF,
        projectUrl,
      }),
    ).toThrow();
  });
});
