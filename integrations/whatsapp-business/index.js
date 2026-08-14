"use strict";

const crypto = require("crypto");

const URGENCY_RULES = [
  { score: 100, reason: "safety or emergency language", pattern: /\b(emergency|911|hospital|unsafe|danger|police)\b/i },
  { score: 90, reason: "same-day deadline", pattern: /\b(due today|by today|expires? today|today's deadline|before close of business|eod)\b/i },
  { score: 85, reason: "real-estate transaction deadline", pattern: /\b(closing|escrow|earnest money|emd|inspection period|signatures?|counteroffer|offer expires?)\b/i },
  { score: 80, reason: "payment or fraud risk", pattern: /\b(fraud|wire instructions|payment failed|past due|chargeback|unauthorized)\b/i },
  { score: 70, reason: "explicit urgency", pattern: /\b(urgent|asap|immediately|time[- ]sensitive|call me now)\b/i },
  { score: 55, reason: "new lead or showing request", pattern: /\b(interested in|showing|tour the property|buying|selling|listing appointment)\b/i },
  { score: 45, reason: "document or scheduling request", pattern: /\b(send (me|over)|document|contract|schedule|reschedule|meeting)\b/i },
];

function scoreUrgency(text) {
  const value = typeof text === "string" ? text.trim() : "";
  const matches = URGENCY_RULES.filter((rule) => rule.pattern.test(value));
  if (matches.length === 0) return { score: 10, reason: "no urgent rule matched" };
  matches.sort((a, b) => b.score - a.score);
  return { score: matches[0].score, reason: matches.map((match) => match.reason).join("; ") };
}

function verifyWebhookChallenge(query, expectedToken) {
  if (query["hub.mode"] !== "subscribe" || query["hub.verify_token"] !== expectedToken) {
    return { status: 403, body: "Forbidden" };
  }
  return { status: 200, body: String(query["hub.challenge"] || "") };
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!Buffer.isBuffer(rawBody) || !signatureHeader || !appSecret) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const receivedBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function messageText(message) {
  if (message.type === "text") return message.text?.body || "";
  if (message.type === "button") return message.button?.text || "";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
  }
  return message[message.type]?.caption || "";
}

function normalizeWebhookPayload(payload, context) {
  const records = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const contacts = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact]));
      for (const message of value.messages || []) {
        const text = messageText(message);
        const urgency = scoreUrgency(text);
        const contact = contacts.get(message.from);
        records.push({
          orgId: context.orgId,
          whatsappMessageId: message.id,
          phoneNumberId: value.metadata?.phone_number_id || context.phoneNumberId || "unknown",
          contactWaId: message.from,
          contactName: contact?.profile?.name,
          direction: "inbound",
          messageType: message.type || "unknown",
          messageText: text || undefined,
          mediaId: message[message.type]?.id,
          replyToMessageId: message.context?.id,
          receivedAt: new Date(Number(message.timestamp) * 1000).toISOString(),
          urgencyScore: urgency.score,
          urgencyReason: urgency.reason,
          rawPayload: message,
        });
      }
    }
  }
  return records;
}

class InMemoryWhatsAppMessageRepository {
  constructor() {
    this.records = new Map();
  }

  async insert(record) {
    const key = `${record.orgId}:${record.whatsappMessageId}`;
    if (this.records.has(key)) return { inserted: false, record: this.records.get(key) };
    const stored = { ...record, createdAt: new Date().toISOString() };
    this.records.set(key, stored);
    return { inserted: true, record: stored };
  }

  async listRecent({ orgId, since, unreviewedOnly = true, minimumUrgency = 0, limit = 100 }) {
    return [...this.records.values()]
      .filter((record) => record.orgId === orgId)
      .filter((record) => new Date(record.receivedAt) >= since)
      .filter((record) => !unreviewedOnly || !record.reviewedAt)
      .filter((record) => record.urgencyScore >= minimumUrgency)
      .sort((a, b) => b.urgencyScore - a.urgencyScore || b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, limit);
  }
}

async function ingestWebhook({ rawBody, signature, appSecret, orgId, phoneNumberId, repository }) {
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return { status: 401, accepted: 0, duplicates: 0, error: "invalid_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { status: 400, accepted: 0, duplicates: 0, error: "invalid_json" };
  }

  const records = normalizeWebhookPayload(payload, { orgId, phoneNumberId });
  let accepted = 0;
  let duplicates = 0;
  for (const record of records) {
    const result = await repository.insert(record);
    if (result.inserted) accepted += 1;
    else duplicates += 1;
  }
  return { status: 200, accepted, duplicates };
}

async function reviewRecentMessages(repository, input) {
  const hours = Math.max(1, Math.min(Number(input.hours || 24), 24 * 30));
  return repository.listRecent({
    orgId: input.orgId,
    since: new Date(Date.now() - hours * 60 * 60 * 1000),
    unreviewedOnly: input.unreviewedOnly !== false,
    minimumUrgency: Number(input.minimumUrgency || 0),
    limit: Math.max(1, Math.min(Number(input.limit || 100), 500)),
  });
}

module.exports = {
  InMemoryWhatsAppMessageRepository,
  ingestWebhook,
  normalizeWebhookPayload,
  reviewRecentMessages,
  scoreUrgency,
  verifyMetaSignature,
  verifyWebhookChallenge,
};
