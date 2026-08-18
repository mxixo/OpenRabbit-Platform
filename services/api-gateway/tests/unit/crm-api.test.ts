import { describe, expect, it } from "vitest";
import { routeNativeCrmApi } from "../../src/crm-api.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";

describe("native CRM API", () => {
  it("creates, lists, reads, updates, and deletes tenant-scoped relationships", async () => {
    const store = new InMemoryNativeCrmStore();
    const created = await routeNativeCrmApi({
      requestId: "crm-create",
      method: "POST",
      path: "/v1/orgs/org-1/crm/relationships",
      body: {
        id: "paris",
        displayName: "Paris Robbins",
        kind: "investor",
        stage: "active",
        priority: "high",
        leadSource: "referral",
        email: "paris@example.com",
        propertyIds: ["deal-1", "deal-1"],
        tags: ["multifamily", "investor"]
      }
    }, store);
    expect(created).toMatchObject({ matched: true, status: 201, data: { id: "paris", orgId: "org-1", priority: "high" } });

    const listed = await routeNativeCrmApi({ requestId: "crm-list", method: "GET", path: "/v1/orgs/org-1/crm/relationships" }, store);
    if (!listed.matched || !listed.data) throw new Error("CRM list failed");
    expect(listed.data).toEqual([expect.objectContaining({ id: "paris", propertyIds: ["deal-1"] })]);

    const isolated = await routeNativeCrmApi({ requestId: "crm-isolated", method: "GET", path: "/v1/orgs/org-2/crm/relationships/paris" }, store);
    expect(isolated).toMatchObject({ matched: true, status: 404, error: { code: "CRM_RELATIONSHIP_NOT_FOUND" } });

    const updated = await routeNativeCrmApi({
      requestId: "crm-update",
      method: "PATCH",
      path: "/v1/orgs/org-1/crm/relationships/paris",
      body: { stage: "touring", nextFollowUpAt: "2026-08-20T15:00:00-07:00" }
    }, store);
    expect(updated).toMatchObject({ matched: true, status: 200, data: { stage: "touring" } });

    const removed = await routeNativeCrmApi({ requestId: "crm-delete", method: "DELETE", path: "/v1/orgs/org-1/crm/relationships/paris" }, store);
    expect(removed).toMatchObject({ matched: true, status: 200, data: { deleted: true } });
  });

  it("validates required fields and priority values", async () => {
    const store = new InMemoryNativeCrmStore();
    const missingName = await routeNativeCrmApi({ requestId: "bad-1", method: "POST", path: "/v1/orgs/org-1/crm/relationships", body: {} }, store);
    expect(missingName).toMatchObject({ matched: true, status: 400, error: { code: "CRM_DISPLAY_NAME_REQUIRED" } });

    const badPriority = await routeNativeCrmApi({ requestId: "bad-2", method: "POST", path: "/v1/orgs/org-1/crm/relationships", body: { displayName: "Lead", priority: "urgent" } }, store);
    expect(badPriority).toMatchObject({ matched: true, status: 400, error: { code: "INVALID_CRM_PRIORITY" } });
  });

  it("maps native records into provider-neutral workspace relationships", async () => {
    const store = new InMemoryNativeCrmStore();
    await store.create("org-1", { id: "r1", displayName: "Investor", email: "private@example.com", priority: "high", summary: "Phoenix multifamily" });
    const items = await store.workspaceItems("org-1");
    expect(items).toEqual([{ id: "r1", displayName: "Investor", priority: "high", summary: "Phoenix multifamily" }]);
    expect(items[0]).not.toHaveProperty("email");
  });
});
