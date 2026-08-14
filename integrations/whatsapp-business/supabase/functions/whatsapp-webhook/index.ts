import { createClient } from "npm:@supabase/supabase-js@2";

type Rule = { score: number; reason: string; pattern: RegExp };

const rules: Rule[] = [
  { score: 100, reason: "safety or emergency language", pattern: /\b(emergency|911|hospital|unsafe|danger|police)\b/i },
  { score: 90, reason: "same-day deadline", pattern: /\b(due today|by today|expires? today|today's deadline|before close of business|eod)\b/i },
  { score: 85, reason: "real-estate transaction deadline", pattern: /\b(closing|escrow|earnest money|emd|inspection period|signatures?|counteroffer|offer expires?)\b/i },
  { score: 80, reason: "payment or fraud risk", pattern: /\b(fraud|wire instructions|payment failed|past due|chargeback|unauthorized)\b/i },
  { score: 70, reason: "explicit urgency", pattern: /\b(urgent|asap|immediately|time[- ]sensitive|call me now)\b/i },
  { score: 55, reason: "new lead or showing request", pattern: /\b(interested in|showing|tour the property|buying|selling|listing appointment)\b/i },
  { score: 45, reason: "document or scheduling request", pattern: /\b(send (me|over)|document|contract|schedule|reschedule|meeting)\b/i },
];

function scoreUrgency(text: string) {
  const matches = rules.filter((rule) => rule.pattern.test(text)).sort((a, b) => b.score - a.score);
  return matches.length
    ? { score: matches[0].score, reason: matches.map((match) => match.reason).join("; ") }
    : { score: 10, reason: "no urgent rule matched" };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(body: Uint8Array, header: string | null, secret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  const expected = new TextEncoder().encode(`sha256=${bytesToHex(digest)}`);
  const received = new TextEncoder().encode(header);
  if (expected.length !== received.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ received[index];
  return difference === 0;
}

function extractText(message: Record<string, any>): string {
  if (message.type === "text") return message.text?.body || "";
  if (message.type === "button") return message.button?.text || "";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
  }
  return message[message.type]?.caption || "";
}

Deno.serve(async (request: Request) => {
  const verifyToken = Deno.env.get("META_VERIFY_TOKEN");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const orgId = Deno.env.get("OPENRABBIT_ORG_ID");

  if (request.method === "GET") {
    const url = new URL(request.url);
    if (
      url.searchParams.get("hub.mode") !== "subscribe" ||
      !verifyToken ||
      url.searchParams.get("hub.verify_token") !== verifyToken
    ) return new Response("Forbidden", { status: 403 });
    return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!appSecret || !orgId) return new Response("Webhook is not configured", { status: 503 });

  const body = new Uint8Array(await request.arrayBuffer());
  if (!(await validSignature(body, request.headers.get("x-hub-signature-256"), appSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const contacts = new Map((value.contacts || []).map((contact: any) => [contact.wa_id, contact]));
      for (const message of value.messages || []) {
        const text = extractText(message);
        const urgency = scoreUrgency(text);
        const contact: any = contacts.get(message.from);
        rows.push({
          org_id: orgId,
          whatsapp_message_id: message.id,
          phone_number_id: value.metadata?.phone_number_id || "unknown",
          contact_wa_id: message.from,
          contact_name: contact?.profile?.name,
          direction: "inbound",
          message_type: message.type || "unknown",
          message_text: text || null,
          media_id: message[message.type]?.id || null,
          reply_to_message_id: message.context?.id || null,
          received_at: new Date(Number(message.timestamp) * 1000).toISOString(),
          urgency_score: urgency.score,
          urgency_reason: urgency.reason,
          raw_payload: message,
        });
      }
    }
  }

  if (rows.length) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase
      .from("whatsapp_messages")
      .upsert(rows, { onConflict: "org_id,whatsapp_message_id", ignoreDuplicates: true });
    if (error) return new Response("Storage failed", { status: 500 });
  }

  return Response.json({ accepted: rows.length });
});
