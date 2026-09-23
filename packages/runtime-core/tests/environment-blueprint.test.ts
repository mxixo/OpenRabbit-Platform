import { describe, expect, it } from "vitest";

import { resolveEnvironmentBlueprint } from "../src/core/environment-blueprint.js";


describe("resolveEnvironmentBlueprint", () => {
  it("projects deterministic industry-neutral environment state", () => {
    const input = {
      orgId: "org-a",
      revision: "rev-42",
      generatedAt: "2026-09-23T04:00:00Z",
      packs: [
        { orgId: "org-a", id: "real-estate", version: "1.0.0", enabled: true },
      ],
      capabilities: [
        {
          orgId: "org-a",
          id: "crm",
          version: "1.2.0",
          enabled: true,
          surfaces: ["work" as const],
        },
        {
          orgId: "org-a",
          id: "calendar",
          version: "1.0.0",
          enabled: true,
          surfaces: ["calendar" as const],
        },
        {
          orgId: "org-a",
          id: "social-publishing",
          version: "1.0.0",
          enabled: false,
          surfaces: ["social" as const],
        },
      ],
      integrations: [
        { orgId: "org-a", id: "gmail", state: "connected" as const },
        { orgId: "org-a", id: "hubspot", state: "available" as const },
        { orgId: "org-a", id: "instagram", state: "missing" as const },
      ],
      workers: [
        { orgId: "org-a", id: "lead-follow-up", capabilityIds: ["crm"] },
      ],
      workflows: ["lead-intake", "daily-agenda"],
      surfaceBindings: {
        communications: { integrationIds: ["gmail"] },
        work: { integrationIds: ["hubspot"], workflowIds: ["lead-intake"] },
        calendar: { workflowIds: ["daily-agenda"] },
      },
      approvalPolicyRef: "approval/review-first/v1",
      modelRoutingPolicyRef: "model-routing/default/v1",
    };

    const first = resolveEnvironmentBlueprint(input);
    const second = resolveEnvironmentBlueprint({
      ...input,
      packs: [...input.packs].reverse(),
      capabilities: [...input.capabilities].reverse(),
      integrations: [...input.integrations].reverse(),
      workflows: [...input.workflows].reverse(),
    });

    expect(second).toEqual(first);
    expect(first.protocol).toBe("environment_blueprint_v1");
    expect(first.surfaces.find((surface) => surface.id === "work")).toEqual({
      id: "work",
      enabled: true,
      capabilityIds: ["crm"],
      integrationIds: ["hubspot"],
      workflowIds: ["lead-intake"],
    });
    expect(first.surfaces.find((surface) => surface.id === "social")).toEqual({
      id: "social",
      enabled: false,
      capabilityIds: [],
      integrationIds: [],
      workflowIds: [],
    });
    expect(first.integrations).toEqual([
      { id: "gmail", state: "connected" },
      { id: "hubspot", state: "available" },
      { id: "instagram", state: "missing" },
    ]);
  });

  it("fails closed on cross-org state", () => {
    expect(() =>
      resolveEnvironmentBlueprint({
        orgId: "org-a",
        revision: "rev-1",
        generatedAt: "2026-09-23T04:00:00Z",
        capabilities: [
          {
            orgId: "org-b",
            id: "crm",
            version: "1.0.0",
            enabled: true,
            surfaces: ["work"],
          },
        ],
      }),
    ).toThrow("cannot project state from another org");
  });

  it("keeps disabled capabilities out of surfaces", () => {
    expect(() =>
      resolveEnvironmentBlueprint({
        orgId: "org-a",
        revision: "rev-1",
        generatedAt: "2026-09-23T04:00:00Z",
        capabilities: [
          {
            orgId: "org-a",
            id: "social-publishing",
            version: "1.0.0",
            enabled: false,
            surfaces: ["social"],
          },
        ],
        surfaceBindings: {
          social: { capabilityIds: ["social-publishing"] },
        },
      }),
    ).toThrow("cannot bind disabled capability social-publishing");
  });

  it("rejects unknown workflow and integration bindings", () => {
    expect(() =>
      resolveEnvironmentBlueprint({
        orgId: "org-a",
        revision: "rev-1",
        generatedAt: "2026-09-23T04:00:00Z",
        surfaceBindings: { work: { workflowIds: ["missing-workflow"] } },
      }),
    ).toThrow("references unknown workflow missing-workflow");

    expect(() =>
      resolveEnvironmentBlueprint({
        orgId: "org-a",
        revision: "rev-1",
        generatedAt: "2026-09-23T04:00:00Z",
        surfaceBindings: { communications: { integrationIds: ["missing-provider"] } },
      }),
    ).toThrow("references unknown integration missing-provider");
  });

  it("rejects workers that reference unknown capabilities", () => {
    expect(() =>
      resolveEnvironmentBlueprint({
        orgId: "org-a",
        revision: "rev-1",
        generatedAt: "2026-09-23T04:00:00Z",
        workers: [
          { orgId: "org-a", id: "worker-a", capabilityIds: ["unknown-capability"] },
        ],
      }),
    ).toThrow("references unknown capability unknown-capability");
  });
});
