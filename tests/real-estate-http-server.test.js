"use strict";

const assert = require("assert");
const { createStaticTokenAuthenticator, createRealEstateHttpServer } = require("../capabilities/real-estate/product-api/http-server");

async function runTests() {
  const calls = [];
  const api = {
    async handle(input) {
      calls.push(input);
      return { status: 201, data: { actorId: input.actorId, orgId: input.path.split("/")[3] } };
    },
  };
  const authenticate = createStaticTokenAuthenticator({
    token: "local-development-secret-32-bytes-minimum",
    actorId: "maico",
    orgId: "org-maico",
  });
  const server = createRealEstateHttpServer({ api, authenticate, maxBodyBytes: 256 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    let response = await fetch(`${baseUrl}/health`);
    assert.strictEqual(response.status, 200);

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals`, { method: "POST" });
    assert.strictEqual(response.status, 401);

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals`, {
      method: "POST", headers: { Authorization: "Bearer wrong-secret" },
    });
    assert.strictEqual(response.status, 401);

    response = await fetch(`${baseUrl}/v1/orgs/other-org/deals`, {
      method: "POST", headers: { Authorization: "Bearer local-development-secret-32-bytes-minimum" },
    });
    assert.strictEqual(response.status, 403);

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals`, {
      method: "POST",
      headers: { Authorization: "Bearer local-development-secret-32-bytes-minimum", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "deal-1" }),
    });
    assert.strictEqual(response.status, 201);
    assert.deepStrictEqual((await response.json()).data, { actorId: "maico", orgId: "org-maico" });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].actorId, "maico");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("Real-estate HTTP server tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
