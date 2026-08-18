import { describe, expect, it } from "vitest";
import type { CalendarPlanItem, WorkerTaskResult } from "@openrabbit/runtime-core";
import { InMemoryEmailStore } from "../../src/email-adapter.js";
import { routeEmailApi } from "../../src/email-api.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

function backend(created: CalendarPlanItem[]): PlatformApiBackend {
  return {
    async installRealEstatePack() { return { packId: "pack.real-estate", workerIds: [] }; },
    async listWorkers() { return []; },
    async submitWorkerTask(input) { return { workerId: input.workerId, taskId: input.taskId, status: "completed", completedAt: new Date().toISOString() } satisfies WorkerTaskResult; },
    async getTaskResult() { return undefined; },
    async listApprovals() { return []; },
    async listAudit() { return []; },
    async decideApproval() { throw new Error("not used"); },
    async createPlanItem(input) {
      const now = new Date().toISOString();
      const item = {
        id: `cal-${created.length + 1}`,
        orgId: input.orgId,
        date: input.date,
        title: input.title,
        status: "planned",
        startAt: input.startAt,
        endAt: input.endAt,
        notes: input.notes,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now
      } as CalendarPlanItem;
      created.push(item);
      return item;
    }
  };
}

describe("email adapter API", () => {
  it("imports provider messages idempotently by provider external id", async () => {
    const store = new InMemoryEmailStore();
    const api = backend([]);
    const first = await routeEmailApi({
      requestId: "e1",
      method: "POST",
      path: "/v1/orgs/org-1/email/import",
      body: { provider: "gmail", messages: [{ externalId: "g-1", subject: "Showing Thursday", from: "buyer@example.com", receivedAt: "2026-08-18T15:16:00Z", needsAction: true, actionType: "scheduling" }] }
    }, store, api);
    expect(first).toMatchObject({ matched: true, status: 200, data: { imported: 1, updated: 0 } });

    const second = await routeEmailApi({
      requestId: "e2",
      method: "POST",
      path: "/v1/orgs/org-1/email/import",
      body: { provider: "gmail", messages: [{ externalId: "g-1", subject: "Showing Thursday updated", from: "buyer@example.com", receivedAt: "2026-08-18T15:16:00Z", needsAction: true, actionType: "scheduling" }] }
    }, store, api);
    expect(second).toMatchObject({ matched: true, status: 200, data: { imported: 0, updated: 1 } });
    expect((await store.list("org-1")).map((item) => item.subject)).toEqual(["Showing Thursday updated"]);
  });

  it("turns a scheduling email into a linked calendar plan item", async () => {
    const store = new InMemoryEmailStore();
    const created: CalendarPlanItem[] = [];
    const api = backend(created);
    const imported = await store.import({
      orgId: "org-1",
      provider: "microsoft",
      messages: [{ externalId: "m-1", subject: "Meet Friday", relationshipId: "rel-1", propertyId: "prop-1", needsAction: true, actionType: "scheduling" }]
    });
    const message = imported.items[0];
    const result = await routeEmailApi({
      requestId: "e3",
      method: "POST",
      path: `/v1/orgs/org-1/email/messages/${message.id}/schedule`,
      body: { startAt: "2026-08-21T15:00:00-07:00", endAt: "2026-08-21T15:30:00-07:00" }
    }, store, api);
    expect(result).toMatchObject({ matched: true, status: 201, data: { messageId: message.id, item: { title: "Meet Friday", date: "2026-08-21" } } });
    expect(created[0]?.metadata).toMatchObject({ emailMessageId: message.id, relationshipId: "rel-1", propertyId: "prop-1" });
    expect((await store.get("org-1", message.id))?.needsAction).toBe(false);
  });

  it("keeps tenant email data isolated", async () => {
    const store = new InMemoryEmailStore();
    await store.import({ orgId: "org-a", provider: "gmail", messages: [{ externalId: "1", subject: "A" }] });
    await store.import({ orgId: "org-b", provider: "gmail", messages: [{ externalId: "1", subject: "B" }] });
    expect((await store.list("org-a")).map((item) => item.subject)).toEqual(["A"]);
    expect((await store.list("org-b")).map((item) => item.subject)).toEqual(["B"]);
  });
});
