"use strict";

const PRODUCTIVITY_PROVIDER_ID = "openrabbit_productivity";

const CAPABILITIES = Object.freeze([
  "calendar.read",
  "calendar.event_create",
  "calendar.event_update",
  "mail.search",
  "mail.read",
  "mail.draft",
  "mail.send",
]);

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

class ProductivityCapabilityProviderAdapter {
  constructor({ calendarClient, mailClient, providerId = PRODUCTIVITY_PROVIDER_ID } = {}) {
    this.id = providerId;
    this.calendarClient = calendarClient;
    this.mailClient = mailClient;
    this.capabilities = CAPABILITIES;
  }

  async healthcheck(capabilityId) {
    if (capabilityId.startsWith("calendar.")) return Boolean(this.calendarClient);
    if (capabilityId.startsWith("mail.")) return Boolean(this.mailClient);
    return false;
  }

  async execute({ capabilityId, orgId, actorId, input = {}, dryRun = false, idempotencyKey }) {
    required(orgId, "orgId");
    required(actorId, "actorId");

    switch (capabilityId) {
      case "calendar.read":
        return this.#calendarRead(input);
      case "calendar.event_create":
        return this.#calendarCreate(input, { dryRun, idempotencyKey });
      case "calendar.event_update":
        return this.#calendarUpdate(input, { dryRun, idempotencyKey });
      case "mail.search":
        return this.#mailSearch(input);
      case "mail.read":
        return this.#mailRead(input);
      case "mail.draft":
        return this.#mailDraft(input, { dryRun, idempotencyKey });
      case "mail.send":
        return this.#mailSend(input, { dryRun, idempotencyKey });
      default:
        throw new Error(`Unsupported productivity capability: ${capabilityId}`);
    }
  }

  async #calendarRead(input) {
    if (!this.calendarClient?.listEvents) throw new Error("Calendar provider is unavailable");
    const start = required(input.start, "input.start");
    const end = required(input.end, "input.end");
    return this.calendarClient.listEvents({ start, end, calendarIds: input.calendarIds, query: input.query });
  }

  async #calendarCreate(input, options) {
    if (!this.calendarClient?.createEvent) throw new Error("Calendar provider is unavailable");
    const event = normalizeEvent(input.event);
    if (options.dryRun) return { dryRun: true, operation: "create", event };
    return this.calendarClient.createEvent(event, { idempotencyKey: options.idempotencyKey });
  }

  async #calendarUpdate(input, options) {
    if (!this.calendarClient?.updateEvent) throw new Error("Calendar provider is unavailable");
    const eventId = required(input.eventId, "input.eventId");
    const patch = normalizeEventPatch(input.patch);
    if (options.dryRun) return { dryRun: true, operation: "update", eventId, patch };
    return this.calendarClient.updateEvent(eventId, patch, { idempotencyKey: options.idempotencyKey });
  }

  async #mailSearch(input) {
    if (!this.mailClient?.search) throw new Error("Mail provider is unavailable");
    return this.mailClient.search({ query: required(input.query, "input.query"), limit: input.limit });
  }

  async #mailRead(input) {
    if (!this.mailClient?.read) throw new Error("Mail provider is unavailable");
    return this.mailClient.read({ messageId: required(input.messageId, "input.messageId") });
  }

  async #mailDraft(input, options) {
    if (!this.mailClient?.createDraft) throw new Error("Mail provider is unavailable");
    const message = normalizeMessage(input.message);
    if (options.dryRun) return { dryRun: true, operation: "draft", message };
    return this.mailClient.createDraft(message, { idempotencyKey: options.idempotencyKey });
  }

  async #mailSend(input, options) {
    if (!this.mailClient?.send) throw new Error("Mail provider is unavailable");
    const message = normalizeMessage(input.message);
    if (options.dryRun) return { dryRun: true, operation: "send", message };
    return this.mailClient.send(message, { idempotencyKey: options.idempotencyKey });
  }
}

function normalizeEvent(event = {}) {
  return {
    title: required(event.title, "input.event.title"),
    start: required(event.start, "input.event.start"),
    end: required(event.end, "input.event.end"),
    ...(event.timeZone ? { timeZone: event.timeZone } : {}),
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { description: event.description } : {}),
    ...(Array.isArray(event.attendees) ? { attendees: [...event.attendees] } : {}),
    ...(event.calendarId ? { calendarId: event.calendarId } : {}),
  };
}

function normalizeEventPatch(patch = {}) {
  const allowed = ["title", "start", "end", "timeZone", "location", "description", "attendees"];
  const next = {};
  for (const key of allowed) if (patch[key] !== undefined) next[key] = patch[key];
  if (Object.keys(next).length === 0) throw new Error("input.patch must contain at least one supported field");
  return next;
}

function normalizeMessage(message = {}) {
  const to = Array.isArray(message.to) ? message.to.filter(Boolean) : [];
  if (to.length === 0) throw new Error("input.message.to is required");
  return {
    to,
    ...(Array.isArray(message.cc) ? { cc: message.cc.filter(Boolean) } : {}),
    ...(Array.isArray(message.bcc) ? { bcc: message.bcc.filter(Boolean) } : {}),
    subject: required(message.subject, "input.message.subject"),
    body: required(message.body, "input.message.body"),
    ...(message.threadId ? { threadId: message.threadId } : {}),
    ...(message.referenceMessageId ? { referenceMessageId: message.referenceMessageId } : {}),
  };
}

module.exports = {
  PRODUCTIVITY_PROVIDER_ID,
  CAPABILITIES,
  ProductivityCapabilityProviderAdapter,
  normalizeEvent,
  normalizeEventPatch,
  normalizeMessage,
};
