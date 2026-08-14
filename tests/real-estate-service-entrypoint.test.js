"use strict";

const assert = require("assert");
const {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const { loadConfig, startApplication } = require("../scripts/start-real-estate-api");

async function runTests() {
  assert.throws(() => loadConfig({}), /OPENRABBIT_API_TOKEN is required/);
  const config = loadConfig({
    OPENRABBIT_API_HOST: "127.0.0.1",
    OPENRABBIT_API_PORT: "0",
    OPENRABBIT_API_TOKEN: "entrypoint-test-secret-at-least-32-bytes",
    OPENRABBIT_ACTOR_ID: "maico",
    OPENRABBIT_ORG_ID: "org-maico",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-only-test-key",
  });
  const repository = new InMemoryRealEstateStateRepository(createInMemoryStateBacking());
  const application = await startApplication(config, { repository });
  const address = application.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    let response = await fetch(`${baseUrl}/health`);
    assert.strictEqual(response.status, 200);

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals`, {
      method: "POST",
      headers: {
        Authorization: "Bearer entrypoint-test-secret-at-least-32-bytes",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "deal-entrypoint", address: "2510 W Palo Verde Dr, Phoenix, AZ" }),
    });
    assert.strictEqual(response.status, 201);
    assert.strictEqual((await response.json()).data.id, "deal-entrypoint");

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals/deal-entrypoint/underwriting-runs`, {
      method: "POST",
      headers: {
        Authorization: "Bearer entrypoint-test-secret-at-least-32-bytes",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskId: "entrypoint-run-1", input: { purchasePrice: 1600000, annualGrossIncome: 260000 } }),
    });
    assert.strictEqual(response.status, 201);
    assert.ok((await response.json()).data.output.report.decision);
  } finally {
    await new Promise((resolve, reject) => application.server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("Real-estate service entrypoint tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
