import { describe, expect, it } from "vitest";
import { routeNativeCrmApi } from "../../src/crm-api.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";

describe("CRM import boundary", () => {
  it("imports provider records and preserves provenance", async () => {
    const store = new InMemoryNativeCrmStore();
    const result = await routeNativeCrmApi({
      requestId: "import-1",
      method: "POST",
      path: "/v1/orgs/org-1/crm/import",
      body: {
        provider: "hubspot",
        records: [
          { externalId: "hs-1", displayName: "Paris Robbins", email: "paris@example.com", kind: "investor", priority: "high" }
        ]
      }
    }, store);

    expect(result).toMatchObject({ matched: true, status: 200, data: { provider: "hubspot", created: 1, updated: 0, skipped: 0 } });
    const rows = await store.list("org-1");
    expect(rows[0]).toMatchObject({ displayName: "Paris Robbins", sourceProvider: "hubspot", externalId: "hs-1", priority: "high" });
  });

  it("merges repeated provider records instead of duplicating relationships", async () => {
    const store = new InMemoryNativeCrmStore();
    const first = { requestId: "import-a", method: "POST", path: "/v1/orgs/org-1/crm/import", body: { provider: "hubspot", records: [{ externalId: "hs-1", displayName: "Investor", email: "investor@example.com", stage: "new" }] } };
    await routeNativeCrmApi(first, store);
    const second = await routeNativeCrmApi({ ...first, requestId: "import-b", body: { provider: "hubspot", records: [{ externalId: "hs-1", displayName: "Investor", email: "investor@example.com", stage: "qualified", priority: "high" }] } }, store);

    expect(second).toMatchObject({ matched: true, status: 200, data: { created: 0, updated: 1, skipped: 0 } });
    const rows = await store.list("org-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stage: "qualified", priority: "high" });
  });

  it("supports create-only imports and tenant isolation", async () => {
    const store = new InMemoryNativeCrmStore();
    await store.create("org-1", { displayName: "Existing", email: "same@example.com" });
    const result = await routeNativeCrmApi({
      requestId: "import-create-only",
      method: "POST",
      path: "/v1/orgs/org-1/crm/import",
      body: { provider: "follow-up-boss", mode: "create_only", records: [{ externalId: "fub-1", displayName: "Existing Elsewhere", email: "same@example.com" }] }
    }, store);

    expect(result).toMatchObject({ matched: true, status: 200, data: { created: 0, updated: 0, skipped: 1 } });
    expect(await store.list("org-1")).toHaveLength(1);
    expect(await store.list("org-2")).toEqual([]);
  });

  it("rejects malformed imports", async () => {
    const result = await routeNativeCrmApi({ requestId: "bad-import", method: "POST", path: "/v1/orgs/org-1/crm/import", body: { provider: "hubspot", records: [] } }, new InMemoryNativeCrmStore());
    expect(result).toMatchObject({ matched: true, status: 400, error: { code: "CRM_IMPORT_RECORDS_REQUIRED" } });
  });
});
