import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { EntityResolutionService } from "../../src/entity-resolution.js";
import { InMemoryEmailStore } from "../../src/email-adapter.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";
import { InMemoryPropertyStore } from "../../src/map-adapter.js";

describe("entity resolution", () => {
  it("auto-links exact sender email matches and explains why", async () => {
    const emails = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const properties = new InMemoryPropertyStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(emails, crm, properties, graph);

    const relationship = await crm.create("org-1", { displayName: "Paris Robbins", email: "paris@example.com" });
    const imported = await emails.import({ orgId: "org-1", provider: "google", messages: [{ externalId: "m1", subject: "Deal follow-up", from: "Paris Robbins <paris@example.com>" }] });
    const result = await resolver.resolveEmail("org-1", imported.items[0].id);

    expect(result.applied).toMatchObject([{ targetType: "relationship", targetId: relationship.id, confidence: 0.995, disposition: "auto_link" }]);
    expect(result.applied[0].reasons[0]).toContain("Exact normalized sender email match");
    expect((await emails.get("org-1", imported.items[0].id))?.relationshipId).toBe(relationship.id);
  });

  it("suggests name/address matches without silently applying them", async () => {
    const emails = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const properties = new InMemoryPropertyStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(emails, crm, properties, graph);

    await crm.create("org-1", { displayName: "Olivia Grijalva" });
    await properties.import({ orgId: "org-1", provider: "mls", records: [{ externalId: "p1", label: "Mohave", address: "1638 W Mohave St", latitude: 33.43, longitude: -112.09 }] });
    const imported = await emails.import({ orgId: "org-1", provider: "google", messages: [{ externalId: "m2", subject: "Olivia Grijalva - 1638 W Mohave St", from: "unknown@example.com" }] });
    const result = await resolver.resolveEmail("org-1", imported.items[0].id);

    expect(result.applied).toEqual([]);
    expect(result.candidates.map((candidate) => candidate.disposition)).toEqual(["suggest", "suggest"]);
    expect((await emails.get("org-1", imported.items[0].id))?.relationshipId).toBeUndefined();
    expect((await emails.get("org-1", imported.items[0].id))?.propertyId).toBeUndefined();
  });

  it("auto-links exact MLS identifier mentions", async () => {
    const emails = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const properties = new InMemoryPropertyStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(emails, crm, properties, graph);

    const property = (await properties.import({ orgId: "org-1", provider: "mls", records: [{ externalId: "p2", label: "Listing", mlsId: "MLS12345", latitude: 33.44, longitude: -112.08 }] })).items[0];
    const imported = await emails.import({ orgId: "org-1", provider: "google", messages: [{ externalId: "m3", subject: "Offer for MLS12345" }] });
    const result = await resolver.resolveEmail("org-1", imported.items[0].id);

    expect(result.applied).toMatchObject([{ targetType: "property", targetId: property.id, disposition: "auto_link" }]);
    expect((await emails.get("org-1", imported.items[0].id))?.propertyId).toBe(property.id);
  });
});
