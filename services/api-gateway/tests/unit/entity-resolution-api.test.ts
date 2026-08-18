import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { InMemoryEmailStore } from "../../src/email-adapter.js";
import { EntityResolutionService } from "../../src/entity-resolution.js";
import { routeEntityResolutionApi } from "../../src/entity-resolution-api.js";
import { InMemoryPropertyStore } from "../../src/map-adapter.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";

describe("entity resolution API", () => {
  it("accepts and records an explicit suggestion decision", async () => {
    const emails = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const properties = new InMemoryPropertyStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(emails, crm, properties, graph);
    const relationship = await crm.create("org-1", { displayName: "Olivia Grijalva" });
    const imported = await emails.import({ orgId: "org-1", provider: "google", messages: [{ externalId: "m1", subject: "Olivia Grijalva follow-up" }] });
    const emailId = imported.items[0].id;

    const response = await routeEntityResolutionApi({
      requestId: "resolve-1",
      method: "POST",
      path: `/v1/orgs/org-1/resolution/email/${emailId}/decision`,
      body: { targetType: "relationship", targetId: relationship.id, decision: "accepted", actorId: "workspace-user" }
    }, resolver);

    expect(response).toMatchObject({ matched: true, status: 200, data: { feedback: { decision: "accepted", actorId: "workspace-user" } } });
    expect((await emails.get("org-1", emailId))?.relationshipId).toBe(relationship.id);

    const feedback = await routeEntityResolutionApi({
      requestId: "resolve-2",
      method: "GET",
      path: `/v1/orgs/org-1/resolution/feedback?emailId=${emailId}`
    }, resolver);
    expect(feedback).toMatchObject({ matched: true, status: 200, data: [{ targetId: relationship.id, decision: "accepted" }] });
  });
});
