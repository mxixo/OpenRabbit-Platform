import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";
import { InMemoryPropertyStore } from "../../src/map-adapter.js";
import { InMemorySocialStore } from "../../src/social-adapter.js";
import { routeNativeCrmApi } from "../../src/crm-api.js";
import { routeMapApi } from "../../src/map-api.js";
import { routeSocialApi } from "../../src/social-api.js";

describe("automatic context linking across primary surfaces", () => {
  it("links CRM relationships to their known properties", async () => {
    const graph = new InMemoryContextGraphStore();
    const store = new InMemoryNativeCrmStore();
    const created = await routeNativeCrmApi({
      requestId: "crm-auto-1", method: "POST", path: "/v1/orgs/org-1/crm/relationships",
      body: { displayName: "Investor", propertyIds: ["prop-1"] }
    }, store, graph);
    expect(created.matched).toBe(true);
    const id = (created as any).data.id;
    const neighborhood = await graph.neighborhood("org-1", { type: "relationship", id });
    expect(neighborhood.neighbors).toContainEqual({ type: "property", id: "prop-1" });
  });

  it("links imported properties to known CRM relationships without duplicate edges", async () => {
    const graph = new InMemoryContextGraphStore();
    const store = new InMemoryPropertyStore();
    const request = {
      requestId: "map-auto-1", method: "POST", path: "/v1/orgs/org-1/map/import",
      body: { provider: "flexmls", records: [{ externalId: "mls-1", label: "123 Main", latitude: 33.45, longitude: -112.07, relationshipIds: ["rel-1"] }] }
    } as const;
    const first = await routeMapApi(request, store, graph);
    const second = await routeMapApi({ ...request, requestId: "map-auto-2" }, store, graph);
    const id = (first as any).data.items[0].id;
    expect((second as any).data.updated).toBe(1);
    const links = await graph.listLinks("org-1", { type: "property", id });
    expect(links).toHaveLength(1);
    expect(links[0].to.id).toBe("rel-1");
  });

  it("links social content to CRM and property context", async () => {
    const graph = new InMemoryContextGraphStore();
    const store = new InMemorySocialStore();
    const created = await routeSocialApi({
      requestId: "social-auto-1", method: "POST", path: "/v1/orgs/org-1/social/posts",
      body: { network: "instagram", body: "New opportunity", relationshipId: "rel-1", propertyId: "prop-1" }
    }, store, graph);
    const id = (created as any).data.id;
    const neighborhood = await graph.neighborhood("org-1", { type: "social", id });
    expect(neighborhood.neighbors).toEqual(expect.arrayContaining([
      { type: "relationship", id: "rel-1" },
      { type: "property", id: "prop-1" }
    ]));
  });
});
