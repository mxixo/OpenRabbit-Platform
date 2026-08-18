import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { InMemoryEmailStore } from "../../src/email-adapter.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";
import { InMemoryPropertyStore } from "../../src/map-adapter.js";
import { InMemorySocialStore } from "../../src/social-adapter.js";
import { InMemoryProviderConnectionStore } from "../../src/provider-connections.js";
import { EntityResolutionService } from "../../src/entity-resolution.js";
import { ProviderSyncCoordinator } from "../../src/provider-sync.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

describe("provider sync coordinator", () => {
  function setup(backend?: PlatformApiBackend) {
    const email = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const property = new InMemoryPropertyStore();
    const social = new InMemorySocialStore();
    const connections = new InMemoryProviderConnectionStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(email, crm, property, graph);
    const sync = new ProviderSyncCoordinator(email, crm, property, social, connections, graph, resolver, () => backend);
    return { email, crm, property, social, connections, graph, sync };
  }

  it("imports provider email and resolves exact CRM sender context", async () => {
    const { email, crm, sync } = setup();
    const relationship = await crm.create("org-1", { displayName: "Buyer One", email: "buyer@example.com" });
    sync.registerEmailAdapter({
      provider: "google",
      async listMessages() { return [{ externalId: "m1", subject: "Showing request", from: "Buyer One <buyer@example.com>" }]; }
    });

    const [run] = await sync.run({ orgId: "org-1", provider: "google", surfaces: ["email"] });
    const messages = await email.list("org-1");

    expect(run.status).toBe("succeeded");
    expect(run.created).toBe(1);
    expect(messages[0].relationshipId).toBe(relationship.id);
  });

  it("does not duplicate calendar events that were already ingested", async () => {
    const created: Array<{ id: string; title: string }> = [];
    const backend = {
      createPlanItem: async (input: { title: string }) => {
        const item = { id: `cal-${created.length + 1}`, title: input.title };
        created.push(item);
        return item;
      }
    } as unknown as PlatformApiBackend;
    const { sync } = setup(backend);
    sync.registerCalendarAdapter({
      provider: "google",
      async listEvents() { return [{ externalId: "event-1", title: "Listing appointment", startAt: "2026-08-18T10:00:00-07:00" }]; },
      async createEvent() { throw new Error("not used"); },
      async updateEvent() { throw new Error("not used"); },
      async cancelEvent() { throw new Error("not used"); }
    });

    const [first] = await sync.run({ orgId: "org-1", provider: "google", surfaces: ["calendar"] });
    const [second] = await sync.run({ orgId: "org-1", provider: "google", surfaces: ["calendar"] });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(created).toHaveLength(1);
  });

  it("imports external social records idempotently", async () => {
    const { social, sync } = setup();
    sync.registerSocialAdapter({
      provider: "meta",
      async listPosts() { return [{ externalId: "post-1", network: "instagram", title: "Buyer tip", status: "published" }]; }
    });

    const [first] = await sync.run({ orgId: "org-1", provider: "meta", surfaces: ["social"] });
    const [second] = await sync.run({ orgId: "org-1", provider: "meta", surfaces: ["social"] });

    expect(first.created).toBe(1);
    expect(second.updated).toBe(1);
    expect(await social.list("org-1")).toHaveLength(1);
  });
});
