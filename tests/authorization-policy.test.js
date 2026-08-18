"use strict";

const assert = require("assert");
const { SCOPES, requiredScopeForRequest, hasScope } = require("../runtime/authorization-policy");
const { loadApiCredentials } = require("../runtime/auth-config");

function runTests() {
  assert.strictEqual(requiredScopeForRequest("POST", "/v1/orgs/org-1/deals"), SCOPES.DEAL_WRITE);
  assert.strictEqual(requiredScopeForRequest("GET", "/v1/orgs/org-1/deals/deal-1"), SCOPES.READ);
  assert.strictEqual(requiredScopeForRequest("POST", "/v1/orgs/org-1/deals/deal-1/underwriting-runs"), SCOPES.UNDERWRITE);
  assert.strictEqual(requiredScopeForRequest("POST", "/v1/orgs/org-1/deals/deal-1/outreach-approvals"), SCOPES.APPROVAL_REQUEST);
  assert.strictEqual(requiredScopeForRequest("POST", "/v1/orgs/org-1/approvals/a-1/decision"), SCOPES.APPROVAL_DECIDE);
  assert.strictEqual(requiredScopeForRequest("POST", "/v1/orgs/org-1/approvals/a-1/execute"), SCOPES.ACTION_EXECUTE);
  assert.strictEqual(requiredScopeForRequest("GET", "/v1/orgs/org-1/audit"), SCOPES.AUDIT_READ);

  assert.strictEqual(hasScope({ scopes: [SCOPES.READ] }, SCOPES.READ), true);
  assert.strictEqual(hasScope({ scopes: [SCOPES.READ] }, SCOPES.APPROVAL_DECIDE), false);
  assert.strictEqual(hasScope({ scopes: ["*"] }, SCOPES.APPROVAL_DECIDE), true);

  const scoped = loadApiCredentials({
    OPENRABBIT_API_CREDENTIALS_JSON: JSON.stringify([{
      token: "scoped-credential-secret-at-least-32-bytes",
      actorId: "analyst-1",
      orgId: "org-1",
      scopes: [SCOPES.READ, SCOPES.UNDERWRITE, SCOPES.READ],
    }]),
  });
  assert.deepStrictEqual(scoped[0].scopes, [SCOPES.READ, SCOPES.UNDERWRITE]);

  const legacy = loadApiCredentials({
    OPENRABBIT_API_TOKEN: "legacy-credential-secret-at-least-32-bytes",
    OPENRABBIT_ACTOR_ID: "legacy",
    OPENRABBIT_ORG_ID: "org-legacy",
  });
  assert.deepStrictEqual(legacy[0].scopes, ["*"]);

  assert.throws(
    () => loadApiCredentials({
      OPENRABBIT_API_CREDENTIALS_JSON: JSON.stringify([{
        token: "empty-scope-secret-at-least-32-bytes-111",
        actorId: "analyst-1",
        orgId: "org-1",
        scopes: [],
      }]),
    }),
    /scopes must be a non-empty array/
  );

  console.log("Authorization policy tests passed.");
}

runTests();
