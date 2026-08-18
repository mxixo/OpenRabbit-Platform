"use strict";

const assert = require("assert");
const {
  ProductivityCapabilityProviderAdapter,
} = require("../capabilities/productivity/provider-adapter");

(async () => {
  const calls = [];
  const calendarClient = {
    async listEvents(input) { calls.push(["calendar.list", input]); return [{ id: "event-1", title: "Review" }]; },
    async createEvent(event, options) { calls.push(["calendar.create", event, options]); return { id: "event-2", ...event }; },
    async updateEvent(eventId, patch, options) { calls.push(["calendar.update", eventId, patch, options]); return { id: eventId, ...patch }; },
  };
  const mailClient = {
    async search(input) { calls.push(["mail.search", input]); return [{ id: "msg-1", subject: "Deal" }]; },
    async read(input) { calls.push(["mail.read", input]); return { id: input.messageId, subject: "Deal", body: "Update" }; },
    async createDraft(message, options) { calls.push(["mail.draft", message, options]); return { id: "draft-1", ...message }; },
    async send(message, options) { calls.push(["mail.send", message, options]); return { id: "sent-1", ...message }; },
  };

  const adapter = new ProductivityCapabilityProviderAdapter({ calendarClient, mailClient });

  assert.equal(await adapter.healthcheck("calendar.read"), true);
  assert.equal(await adapter.healthcheck("mail.read"), true);

  const events = await adapter.execute({
    capabilityId: "calendar.read",
    orgId: "org-1",
    actorId: "actor-1",
    input: { start: "2026-08-18T00:00:00-07:00", end: "2026-08-19T00:00:00-07:00" },
  });
  assert.equal(events[0].id, "event-1");

  const calendarDryRun = await adapter.execute({
    capabilityId: "calendar.event_create",
    orgId: "org-1",
    actorId: "actor-1",
    dryRun: true,
    input: { event: { title: "Meeting", start: "2026-08-18T15:00:00-07:00", end: "2026-08-18T15:30:00-07:00" } },
  });
  assert.equal(calendarDryRun.dryRun, true);
  assert.equal(calls.filter(([name]) => name === "calendar.create").length, 0);

  const search = await adapter.execute({
    capabilityId: "mail.search",
    orgId: "org-1",
    actorId: "actor-1",
    input: { query: "is:unread" },
  });
  assert.equal(search[0].id, "msg-1");

  const draft = await adapter.execute({
    capabilityId: "mail.draft",
    orgId: "org-1",
    actorId: "actor-1",
    idempotencyKey: "draft-1",
    input: { message: { to: ["client@example.com"], subject: "Update", body: "Hello" } },
  });
  assert.equal(draft.id, "draft-1");

  const sendDryRun = await adapter.execute({
    capabilityId: "mail.send",
    orgId: "org-1",
    actorId: "actor-1",
    dryRun: true,
    input: { message: { to: ["client@example.com"], subject: "Update", body: "Hello" } },
  });
  assert.equal(sendDryRun.dryRun, true);
  assert.equal(calls.filter(([name]) => name === "mail.send").length, 0);

  console.log("productivity-capability-provider.test.js passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
