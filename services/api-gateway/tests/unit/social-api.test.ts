import { describe, expect, it } from "vitest";
import { InMemorySocialStore } from "../../src/social-adapter.js";
import { routeSocialApi } from "../../src/social-api.js";

describe("social queue and autonomy policy", () => {
  it("defaults to draft-only and forces worker scheduled posts to approval", async () => {
    const store = new InMemorySocialStore();
    const policy = await store.getPolicy("org-1");
    expect(policy.autonomyMode).toBe("draft_only");

    const created = await routeSocialApi({
      requestId: "s1",
      method: "POST",
      path: "/v1/orgs/org-1/social/posts",
      body: {
        network: "instagram",
        body: "Phoenix buyer tip",
        createdBy: "worker",
        status: "scheduled",
        scheduledAt: "2026-08-18T19:00:00Z"
      }
    }, store);

    expect(created).toMatchObject({ matched: true, status: 201, data: { status: "pending_approval", network: "instagram" } });
  });

  it("requires an explicit policy change before trusted autopilot", async () => {
    const store = new InMemorySocialStore();
    const updated = await routeSocialApi({
      requestId: "s2",
      method: "PUT",
      path: "/v1/orgs/org-1/social/policy",
      body: { autonomyMode: "trusted_autopilot", maxPostsPerDay: 2, allowedNetworks: ["Instagram", "LinkedIn"] }
    }, store);
    expect(updated).toMatchObject({ matched: true, status: 200, data: { autonomyMode: "trusted_autopilot", maxPostsPerDay: 2 } });

    const created = await store.create("org-1", {
      network: "linkedin",
      body: "Market update",
      createdBy: "worker",
      status: "scheduled"
    });
    expect(created.status).toBe("scheduled");
  });

  it("keeps social queues tenant scoped", async () => {
    const store = new InMemorySocialStore();
    await store.create("org-1", { network: "facebook", body: "Seller update" });
    expect(await store.list("org-2")).toEqual([]);
  });

  it("rejects invalid autonomy modes", async () => {
    const result = await routeSocialApi({
      requestId: "s3",
      method: "PUT",
      path: "/v1/orgs/org-1/social/policy",
      body: { autonomyMode: "automatic_forever" }
    }, new InMemorySocialStore());
    expect(result).toMatchObject({ matched: true, status: 400, error: { code: "INVALID_SOCIAL_AUTONOMY_MODE" } });
  });
});
