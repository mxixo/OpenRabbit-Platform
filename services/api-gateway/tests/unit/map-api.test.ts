import { describe, expect, it } from "vitest";
import { InMemoryPropertyStore } from "../../src/map-adapter.js";
import { routeMapApi } from "../../src/map-api.js";

describe("property map API", () => {
  it("imports provider records idempotently and preserves MLS context", async () => {
    const store = new InMemoryPropertyStore();
    const request = {
      requestId: "m1",
      method: "POST",
      path: "/v1/orgs/org-1/map/import",
      body: {
        provider: "flexmls",
        records: [{
          externalId: "abc-1",
          mlsId: "MLS123",
          label: "123 Main St",
          latitude: 33.4484,
          longitude: -112.074,
          kind: "opportunity",
          price: 725000,
          units: 4,
          relationshipIds: ["rel-1"]
        }]
      }
    } as const;

    const first = await routeMapApi(request, store);
    expect(first).toMatchObject({ matched: true, status: 200, data: { imported: 1, updated: 0 } });
    const second = await routeMapApi(request, store);
    expect(second).toMatchObject({ matched: true, status: 200, data: { imported: 0, updated: 1 } });

    const items = await store.workspaceItems("org-1");
    expect(items[0]).toMatchObject({ kind: "opportunity", price: 725000, relationshipIds: ["rel-1"], metadata: { mlsId: "MLS123", units: 4 } });
  });

  it("keeps records tenant scoped and filters by map bounds", async () => {
    const store = new InMemoryPropertyStore();
    await store.import({ orgId: "org-1", provider: "test", records: [
      { externalId: "phx", label: "Phoenix", latitude: 33.4484, longitude: -112.074, kind: "listing" },
      { externalId: "tuc", label: "Tucson", latitude: 32.2226, longitude: -110.9747, kind: "listing" }
    ] });
    await store.import({ orgId: "org-2", provider: "test", records: [
      { externalId: "other", label: "Other tenant", latitude: 33.45, longitude: -112.07, kind: "listing" }
    ] });

    const result = await routeMapApi({
      requestId: "m2",
      method: "GET",
      path: "/v1/orgs/org-1/map/items?north=34&south=33&east=-111&west=-113"
    }, store);
    if (!result.matched || !Array.isArray(result.data)) throw new Error("expected map data");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ label: "Phoenix" });
  });

  it("rejects invalid coordinates and incomplete bounds", async () => {
    const store = new InMemoryPropertyStore();
    const invalidRecord = await routeMapApi({
      requestId: "m3",
      method: "POST",
      path: "/v1/orgs/org-1/map/import",
      body: { provider: "test", records: [{ externalId: "x", label: "Bad", latitude: 999, longitude: 0 }] }
    }, store);
    expect(invalidRecord).toMatchObject({ matched: true, status: 400, error: { code: "INVALID_MAP_RECORD" } });

    const invalidBounds = await routeMapApi({ requestId: "m4", method: "GET", path: "/v1/orgs/org-1/map/items?north=34" }, store);
    expect(invalidBounds).toMatchObject({ matched: true, status: 400, error: { code: "INVALID_MAP_BOUNDS" } });
  });
});
