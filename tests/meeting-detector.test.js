"use strict";

const assert = require("assert");
const { StructuredMeetingDetector, normalizeCandidate } = require("../capabilities/productivity/meeting-detector");

assert.equal(normalizeCandidate({ isMeeting: false }), null);
assert.equal(normalizeCandidate({ isMeeting: true, confidence: 0.6, evidence: ["tomorrow"], event: { title: "Call", start: "2026-08-20T10:00:00-07:00", end: "2026-08-20T10:30:00-07:00" } }), null, "low confidence must abstain");
assert.equal(normalizeCandidate({ isMeeting: true, confidence: 0.9, evidence: [], event: { title: "Call", start: "2026-08-20T10:00:00-07:00", end: "2026-08-20T10:30:00-07:00" } }), null, "evidence is required");

(async () => {
  const detector = new StructuredMeetingDetector({ extractor: async () => ([
    { isMeeting: true, confidence: 0.94, evidence: ["Can we meet Thursday at 10?"], event: { title: "Investor call", start: "2026-08-20T10:00:00-07:00", end: "2026-08-20T10:30:00-07:00", attendees: ["client@example.com"] } },
    { isMeeting: true, confidence: 0.45, evidence: ["maybe next week"], event: { title: "Vague", start: "2026-08-24T10:00:00-07:00", end: "2026-08-24T10:30:00-07:00" } },
  ]) });
  const result = await detector.detect({ id: "msg-1", subject: "Meeting", body: "Can we meet Thursday at 10?" });
  assert.equal(result.length, 1);
  assert.equal(result[0].event.title, "Investor call");
  assert.equal(result[0].confidence, 0.94);
  console.log("meeting-detector.test.js passed");
})().catch((error) => { console.error(error); process.exit(1); });
