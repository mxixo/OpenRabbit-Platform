"use strict";

const assert = require("assert");
const crypto = require("crypto");
const {
  InMemoryWhatsAppMessageRepository,
  ingestWebhook,
  reviewRecentMessages,
  scoreUrgency,
  verifyMetaSignature,
  verifyWebhookChallenge,
} = require("../integrations/whatsapp-business");

async function runTests() {
  const appSecret = "test-only-app-secret";
  const payload = {
    entry: [{
      changes: [{
        field: "messages",
        value: {
          metadata: { phone_number_id: "phone-1" },
          contacts: [{ wa_id: "16025550123", profile: { name: "Test Buyer" } }],
          messages: [{
            from: "16025550123",
            id: "wamid.test-1",
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: "text",
            text: { body: "Urgent: the offer expires today and we need signatures." },
          }],
        },
      }],
    }],
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

  assert.deepStrictEqual(
    verifyWebhookChallenge(
      { "hub.mode": "subscribe", "hub.verify_token": "token", "hub.challenge": "123" },
      "token"
    ),
    { status: 200, body: "123" }
  );
  assert.strictEqual(verifyMetaSignature(rawBody, signature, appSecret), true);
  assert.strictEqual(verifyMetaSignature(Buffer.from("tampered"), signature, appSecret), false);
  assert.ok(scoreUrgency("The closing is tomorrow").score >= 80);

  const repository = new InMemoryWhatsAppMessageRepository();
  const first = await ingestWebhook({ rawBody, signature, appSecret, orgId: "org-1", repository });
  assert.deepStrictEqual(first, { status: 200, accepted: 1, duplicates: 0 });

  const duplicate = await ingestWebhook({ rawBody, signature, appSecret, orgId: "org-1", repository });
  assert.deepStrictEqual(duplicate, { status: 200, accepted: 0, duplicates: 1 });

  const urgent = await reviewRecentMessages(repository, {
    orgId: "org-1",
    hours: 24,
    minimumUrgency: 70,
  });
  assert.strictEqual(urgent.length, 1);
  assert.strictEqual(urgent[0].contactName, "Test Buyer");
  assert.strictEqual(urgent[0].whatsappMessageId, "wamid.test-1");
  assert.ok(urgent[0].urgencyReason.includes("same-day deadline"));

  const otherOrg = await reviewRecentMessages(repository, { orgId: "org-2", hours: 24 });
  assert.deepStrictEqual(otherOrg, []);

  const rejected = await ingestWebhook({
    rawBody,
    signature: "sha256=bad",
    appSecret,
    orgId: "org-1",
    repository,
  });
  assert.strictEqual(rejected.status, 401);

  console.log("WhatsApp Business integration tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
