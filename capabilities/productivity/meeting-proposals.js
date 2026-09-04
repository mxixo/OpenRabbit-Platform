"use strict";

const crypto = require("crypto");

const TERMINAL = new Set(["rejected", "executed"]);

class InMemoryMeetingProposalStore {
  constructor() { this.items = new Map(); }
  save(item) { this.items.set(item.id, structuredClone(item)); return this.get(item.id); }
  get(id) { const item = this.items.get(id); return item ? structuredClone(item) : null; }
  list() { return [...this.items.values()].map((x) => structuredClone(x)); }
}

class MeetingProposalWorkflow {
  constructor({ capabilityProvider, detector, store = new InMemoryMeetingProposalStore(), now = () => new Date().toISOString() } = {}) {
    if (!capabilityProvider?.execute) throw new Error("capabilityProvider.execute is required");
    if (!detector?.detect) throw new Error("detector.detect is required");
    this.capabilityProvider = capabilityProvider;
    this.detector = detector;
    this.store = store;
    this.now = now;
  }

  async scanMail({ orgId, actorId, query = "is:unread", limit = 25 }) {
    const hits = await this.capabilityProvider.execute({ capabilityId: "mail.search", orgId, actorId, input: { query, limit } });
    const proposals = [];
    for (const hit of hits || []) {
      const message = await this.capabilityProvider.execute({ capabilityId: "mail.read", orgId, actorId, input: { messageId: hit.id } });
      const detections = await this.detector.detect(message) || [];
      for (const detection of detections) proposals.push(await this.createProposal({ orgId, actorId, message, detection }));
    }
    return proposals;
  }

  async createProposal({ orgId, actorId, message, detection }) {
    validateDetection(detection);
    const id = detection.id || `meeting-${crypto.randomUUID()}`;
    const proposal = {
      id,
      type: "calendar_event",
      status: "proposed",
      orgId,
      createdBy: actorId,
      source: { kind: "mail", messageId: message.id, threadId: message.threadId, subject: message.subject, from: message.from },
      confidence: Number.isFinite(Number(detection.confidence)) ? Number(detection.confidence) : null,
      event: normalizeEvent(detection.event),
      history: [{ action: "detected", actorId, at: this.now() }, { action: "proposed", actorId: "openrabbit", at: this.now() }],
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    await this.capabilityProvider.execute({ capabilityId: "calendar.event_create", orgId, actorId, dryRun: true, input: { event: proposal.event } });
    return this.store.save(proposal);
  }

  edit(id, patch, actorId) {
    const proposal = this.require(id);
    if (TERMINAL.has(proposal.status)) throw new Error(`Cannot edit ${proposal.status} proposal`);
    proposal.event = normalizeEvent({ ...proposal.event, ...patch });
    proposal.status = "proposed";
    proposal.updatedAt = this.now();
    proposal.history.push({ action: "edited", actorId, at: this.now() });
    return this.store.save(proposal);
  }

  approve(id, actorId) { return this.transition(id, "approved", actorId); }
  reject(id, actorId) { return this.transition(id, "rejected", actorId); }

  async execute(id, actorId) {
    const proposal = this.require(id);
    if (proposal.status !== "approved") throw new Error("Meeting proposal must be approved before execution");
    const result = await this.capabilityProvider.execute({
      capabilityId: "calendar.event_create",
      orgId: proposal.orgId,
      actorId,
      idempotencyKey: `meeting-proposal:${proposal.id}`,
      input: { event: proposal.event },
    });
    proposal.status = "executed";
    proposal.calendarEventId = result?.id;
    proposal.updatedAt = this.now();
    proposal.history.push({ action: "executed", actorId, at: this.now(), calendarEventId: result?.id });
    this.store.save(proposal);
    return { proposal: this.store.get(id), result };
  }

  list(status) { return this.store.list().filter((x) => !status || x.status === status); }

  transition(id, status, actorId) {
    const proposal = this.require(id);
    if (TERMINAL.has(proposal.status)) throw new Error(`Cannot change ${proposal.status} proposal`);
    proposal.status = status;
    proposal.updatedAt = this.now();
    proposal.history.push({ action: status, actorId, at: this.now() });
    return this.store.save(proposal);
  }

  require(id) { const proposal = this.store.get(id); if (!proposal) throw new Error("Meeting proposal not found"); return proposal; }
}

function validateDetection(detection) {
  if (!detection || typeof detection !== "object") throw new Error("detection is required");
  normalizeEvent(detection.event);
}

function normalizeEvent(event = {}) {
  for (const key of ["title", "start", "end"]) if (typeof event[key] !== "string" || !event[key].trim()) throw new Error(`event.${key} is required`);
  return {
    title: event.title.trim(), start: event.start.trim(), end: event.end.trim(),
    ...(event.timeZone ? { timeZone: event.timeZone } : {}),
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { description: event.description } : {}),
    ...(Array.isArray(event.attendees) ? { attendees: [...event.attendees] } : {}),
  };
}

module.exports = { MeetingProposalWorkflow, InMemoryMeetingProposalStore };
