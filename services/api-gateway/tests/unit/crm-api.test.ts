import { describe, expect, it } from "vitest";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";
import { routeNativeCrmApi } from "../../src/crm-api.js";

describe("native CRM API", () => {
  it("creates, lists, reads, updates, and deletes tenant-scoped relationships", async () => {
    const store = new InMemoryNativeCrmStore();
    const created = await routeNativeCrmApi({ requestId: "c1", method: "POST", path: "/v1/orgs/org-1/crm/relationships", body: { id: "rel-1", displayName: "Paris Robbins", kind: "investor", priority: "high", email: "paris@example.com", tags: ["multifamily", "phoenix"] } }, store);
    expect(created).toMatchObject({ matched: true, status: 201, data: { id: "rel-1", displayName: "Paris Robbins", priority: "high" } });

    const list = await routeNativeCrmApi({ requestId: "c2", method: "GET", path: "/v1/orgs/org-1/crm/relationships" }, store);
    expect(list).toMatchObject({ matched: true, status: 200 });
    expect((list as { data: unknown[] }).data).toHaveLength(1);

    const foreign = await routeNativeCrmApi({ requestId: "c3", method: "GET", path: "/v1/orgs/org-2/crm/relationships/rel-1" }, store);
    expect(foreign).toMatchObject({ matched: true, status: 404 });

    const updated = await routeNativeCrmApi({ requestId: "c4", method: "PATCH", path: "/v1/orgs/org-1/crm/relationships/rel-1", body: { stage: "active", nextFollowUpAt: "2026-08-20T10:00:00-07:00", priority: "medium" } }, store);
    expect(updated).toMatchObject({ matched: true, status: 200, data: { stage: "active", priority: "medium" } });

    const removed = await routeNativeCrmApi({ requestId: "c5", method: "DELETE", path: "/v1/orgs/org-1/crm/relationships/rel-1" }, store);
    expect(removed).toMatchObject({ matched: true, status: 200, data: { deleted: true } });
  });

  it("validates required names and priority values", async () => {
    const store = new InMemoryNativeCrmStore();
    const missingName = await routeNativeCrmApi({ requestId: "bad1", method: "POST", path: "/v1/orgs/org-1/crm/relationships", body: {} }, store);
    expect(missingName).toMatchObject({ matched: true, status: 400, error: { code: "CRM_DISPLAY_NAME_REQUIRED" } });

    const badPriority = await routeNativeCrmApi({ requestId: "bad2", method: "POST", path: "/v1/orgs/org-1/crm/relationships", body: { displayName: "Lead", priority: "urgent" } }, store);
    expect(badPriority).toMatchObject({ matched: true, status: 400, error: { code: "INVALID_CRM_PRIORITY" } });
  });

  it("normalizes imported records through the same relationship store", async () => {
    const store = new InMemoryNativeCrmStore();
    const imported = await routeNativeCrmApi({
      requestId: "import",
      method: "POST",
      path: "/v1/orgs/org-1/crm/import",
      body: { provider: "hubspot", records: [{ externalId: "hs-1", displayName: "Seller Lead", email: "seller@example.com", kind: "lead", stage: "new" }] }
    }, store);
    expect(imported).toMatchObject({ matched: true, status: 200, data: { provider: "hubspot", created: 1 } });

    const rows = await store.list("org-1");
    expect(rows[0]).toMatchObject({ displayName: "Seller Lead", sourceProvider: "hubspot", externalId: "hs-1" });
  });
});
