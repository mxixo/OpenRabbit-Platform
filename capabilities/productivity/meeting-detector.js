"use strict";

function clean(value) { return typeof value === "string" ? value.trim() : ""; }

function normalizeCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== "object") throw new Error("meeting candidate must be an object");
  if (candidate.isMeeting === false) return null;
  const event = candidate.event || {};
  const title = clean(event.title);
  const start = clean(event.start);
  const end = clean(event.end);
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.map(clean).filter(Boolean) : [];
  const confidence = Number(candidate.confidence);
  if (!title || !start || !end) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (confidence < 0.7 || evidence.length === 0) return null;
  return {
    confidence,
    evidence,
    event: {
      title,
      start,
      end,
      ...(clean(event.timeZone) ? { timeZone: clean(event.timeZone) } : {}),
      ...(clean(event.location) ? { location: clean(event.location) } : {}),
      ...(clean(event.description) ? { description: clean(event.description) } : {}),
      ...(Array.isArray(event.attendees) ? { attendees: event.attendees.map(clean).filter(Boolean) } : {}),
    },
  };
}

class StructuredMeetingDetector {
  constructor({ extractor } = {}) {
    if (typeof extractor !== "function") throw new Error("extractor is required");
    this.extractor = extractor;
  }

  async detect(message) {
    const raw = await this.extractor({
      id: message?.id,
      threadId: message?.threadId,
      from: message?.from,
      subject: message?.subject,
      body: message?.body,
      receivedAt: message?.receivedAt,
    });
    const candidates = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return candidates.map(normalizeCandidate).filter(Boolean);
  }
}

module.exports = { StructuredMeetingDetector, normalizeCandidate };
