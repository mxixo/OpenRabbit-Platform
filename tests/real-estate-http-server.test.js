"use strict";

const assert = require("assert");
const {
  createTokenSetAuthenticator,
  createStaticTokenAuthenticator,
  createRealEstateHttpServer,
} = require("../capabilities/real-estate/product-api/http-server");
const { SCOPES } = require("../runtime/authorization-policy");

async function exerciseServer(authenticate) {
  const calls = [];
  const api = {
    async handle(input) {
      calls.push(input);
      return { status: 201, data: { actorId: input.actorId, orgId: input.path.split("/")[3] } };
    },
  };
  const server = createRealEstateHttpServer({ api, authenticate, maxBodyBytes: 256 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, calls, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function runTests() {
  assert.throws(
    () => createTokenSetAuthenticator([
      { token: "same-secret-token-at-least-32-bytes-111", actorId: "a", orgId: "org-1" },
      { token: "same-secret-token-at-least-32-bytes-111", actorId: "b", orgId: "org-2" },
    ]),
    /duplicate credential token/
  );

  const authenticate = createTokenSetAuthenticator([
    {
      token: "tenant-one-secret-token-at-least-32-bytes",
      actorId: "analyst-1",
      orgId: "org-maico",
      scopes: [SCOPES.READ, SCOPES.DEAL_WRITE, SCOPES.UNDERWRITE, SCOPES.APPROVAL_REQUEST],
    },
    {
      token: "tenant-two-secret-token-at-least-32-bytes",
      actorId: "manager-2",
      orgId: "org-two",
      scopes: ["*"],
    },
  ]);
  const { server, calls, baseUrl } = await exerciseServer(authenticate);
  try {
    let response = await fetch(`${baseUrl}/health`);
    assert.strictEqual(response.status, 200);

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals`, { method: "POST" });
    assert.strictEqual(response.status, 401);

    response = await fetch(`${baseUrl}/v1/orgs/org-two/deals`, {
      method: "POST", headers: { Authorization: "Bearer tenant-one-secret-token-at-least-32-bytes" },
    });
    assert.strictEqual(response.status, 403);
    assert.strictEqual((await response.json()).error.code, "TENANT_FORBIDDEN");

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/deals`, {
      method: "POST",
      headers: { Authorization: "Bearer tenant-one-secret-token-at-least-32-bytes", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "deal-1" }),
    });
    assert.strictEqual(response.status, 201);

    response = await fetch(`${baseUrl}/v1/orgs/org-maico/approvals/approval-1/decision`, {
      method: "POST",
      headers: { Authorization: "Bearer tenant-one-secret-token-at-least-32-bytes", "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.strictEqual(response.status, 403);
    const forbidden = await response.json();
    assert.strictEqual(forbidden.error.code, "SCOPE_FORBIDDEN");
    assert.strictEqual(forbidden.error.requiredScope, SCOPES.APPROVAL_DECIDE);

    response = await fetch(`${baseUrl}/v1/orgs/org-two/approvals/approval-2/decision`, {
      method: "POST",
      headers: { Authorization: "Bearer tenant-two-secret-token-at-least-32-bytes", "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.strictEqual(response.status, 201);
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls.map((call) => call.actorId), ["analyst-1", "manager-2"]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  const legacy = createStaticTokenAuthenticator({
    token: "legacy-development-secret-32-bytes-minimum",
    actorId: "legacy-actor",
    orgId: "legacy-org",
  });
  assert.deepStrictEqual(
    await legacy({ headers: { authorization: "Bearer legacy-development-secret-32-bytes-minimum" } }),
    { actorId: "legacy-actor", orgId: "legacy-org", scopes: ["*"] }
  );

  console.log("Real-estate HTTP server tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
