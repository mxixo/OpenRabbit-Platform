import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { InMemoryEmailStore } from "../../src/email-adapter.js";
import { InMemoryNativeCrmStore } from "../../src/native-crm.js";
import { InMemoryPropertyStore } from "../../src/map-adapter.js";
import { InMemorySocialStore } from "../../src/social-adapter.js";
import { InMemoryProviderConnectionStore } from "../../src/provider-connections.js";
import { EntityResolutionService } from "../../src/entity-resolution.js";
import { ProviderSyncCoordinator } from "../../src/provider-sync.js";
import { ProviderSyncScheduler } from "../../src/provider-sync-scheduler.js";

describe("provider sync scheduler", () => {
  it("runs due schedules and records the result", async () => {
    const email = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const property = new InMemoryPropertyStore();
    const social = new InMemorySocialStore();
    const connections = new InMemoryProviderConnectionStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(email, crm, property, graph);
    const sync = new ProviderSyncCoordinator(email, crm, property, social, connections, graph, resolver, () => undefined);
    sync.registerEmailAdapter({ provider: "google", async listMessages() { return [{ externalId: "mail-1", subject: "New lead" }]; } });
    const scheduler = new ProviderSyncScheduler(sync);
    const schedule = scheduler.create({ orgId: "org-1", provider: "google", surfaces: ["email"], intervalMinutes: 1 });

    await scheduler.tick(Date.parse(schedule.nextRunAt) + 1);

    const updated = scheduler.get("org-1", schedule.id);
    expect(updated?.lastStatus).toBe("succeeded");
    expect(updated?.lastRunAt).toBeTruthy();
    expect((await email.list("org-1"))).toHaveLength(1);
  });

  it("does not run disabled schedules", async () => {
    const email = new InMemoryEmailStore();
    const crm = new InMemoryNativeCrmStore();
    const property = new InMemoryPropertyStore();
    const social = new InMemorySocialStore();
    const connections = new InMemoryProviderConnectionStore();
    const graph = new InMemoryContextGraphStore();
    const resolver = new EntityResolutionService(email, crm, property, graph);
    const sync = new ProviderSyncCoordinator(email, crm, property, social, connections, graph, resolver, () => undefined);
    sync.registerEmailAdapter({ provider: "google", async listMessages() { return [{ externalId: "mail-1", subject: "New lead" }]; } });
    const scheduler = new ProviderSyncScheduler(sync);
    const schedule = scheduler.create({ orgId: "org-1", provider: "google", surfaces: ["email"], intervalMinutes: 1, enabled: false });

    await scheduler.tick(Date.parse(schedule.nextRunAt) + 1);

    expect(scheduler.get("org-1", schedule.id)?.lastRunAt).toBeUndefined();
    expect(await email.list("org-1")).toHaveLength(0);
  });
});
