import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { routeContextApi } from "../../src/context-api.js";

describe("context graph and environment actions", () => {
  it("links entities and returns their neighborhood", async () => {
    const store = new InMemoryContextGraphStore();
    const created = await routeContextApi({
      requestId: "ctx-1", method: "POST", path: "/v1/orgs/org-1/context/links",
      body: {
        from: { type: "email", id: "email-1", label: "Buyer follow-up" },
        to: { type: "relationship", id: "rel-1", label: "Paris Robbins" },
        relation: "about", confidence: 0.98, source: "worker"
      }
    }, store);
    expect(created).toMatchObject({ matched: true, status: 201, data: { relation: "about" } });

    const neighborhood = await routeContextApi({
      requestId: "ctx-2", method: "GET", path: "/v1/orgs/org-1/context/neighborhood?entityType=email&entityId=email-1"
    }, store);
    expect(neighborhood).toMatchObject({ matched: true, status: 200, data: { neighbors: [{ type: "relationship", id: "rel-1" }] } });
  });

  it("keeps graph data tenant scoped", async () => {
    const store = new InMemoryContextGraphStore();
    await store.addLink("org-1", { from: { type: "property", id: "p1" }, to: { type: "relationship", id: "r1" }, relation: "related_to" });
    expect(await store.listLinks("org-2")).toEqual([]);
  });

  it("records explicit action state instead of hiding agent execution", async () => {
    const store = new InMemoryContextGraphStore();
    const created = await routeContextApi({
      requestId: "act-1", method: "POST", path: "/v1/orgs/org-1/actions",
      body: {
        actionType: "email.send_document",
        status: "pending_approval",
        actorType: "worker",
        actorId: "transaction-worker",
        summary: "Send requested compensation form",
        entities: [{ type: "relationship", id: "rel-1" }, { type: "property", id: "prop-1" }]
      }
    }, store);
    expect(created).toMatchObject({ matched: true, status: 201, data: { status: "pending_approval", actorType: "worker" } });
  });
});
