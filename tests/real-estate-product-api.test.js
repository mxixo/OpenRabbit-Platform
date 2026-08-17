"use strict";

const assert = require("assert");
const {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const { DurableUnderwritingService } = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const {
  ControlledOutreachTransport,
  ApprovalEnforcedOutreachService,
} = require("../capabilities/real-estate/product-api/approval-enforced-outreach");
const { RealEstateProductApi } = require("../capabilities/real-estate/product-api/product-api");

function buildApi(backing, deliveries) {
  const repository = new InMemoryRealEstateStateRepository(backing);
  const durableService = new DurableUnderwritingService({ repository });
  const transport = new ControlledOutreachTransport({ deliveries });
  const outreachService = new ApprovalEnforcedOutreachService({ repository, durableService, transport });
  return { api: new RealEstateProductApi({ durableService, repository, outreachService }), repository };
}

async function runTests() {
  const backing = createInMemoryStateBacking();
  const deliveries = new Map();
  const first = buildApi(backing, deliveries);

  let response = await first.api.handle({
    method: "POST", path: "/v1/orgs/org-maico/deals",
    body: { id: "deal-1", address: "2510 W Palo Verde Dr, Phoenix, AZ", propertyType: "multifamily" },
  });
  assert.strictEqual(response.status, 201);

  response = await first.api.handle({
    method: "POST", path: "/v1/orgs/org-maico/deals/deal-1/underwriting-runs",
    body: { taskId: "underwrite-1", input: { purchasePrice: 1600000, annualGrossIncome: 260000 } },
  });
  assert.strictEqual(response.status, 201);
  assert.ok(response.data.output.report.decision);

  response = await first.api.handle({
    method: "POST", path: "/v1/orgs/org-maico/deals/deal-1/underwriting-runs",
    body: { taskId: "underwrite-invalid", input: { annualGrossIncome: 260000 } },
  });
  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.error.code, "VALIDATION_ERROR");
  assert.strictEqual(response.error.field, "input.purchasePrice");
  assert.strictEqual(response.error.retryable, false);

  const restarted = buildApi(backing, deliveries);
  response = await restarted.api.handle({ method: "GET", path: "/v1/orgs/org-maico/deals/deal-1/underwriting-runs" });
  assert.strictEqual(response.data.length, 1);

  response = await restarted.api.handle({
    method: "POST", path: "/v1/orgs/org-maico/deals/deal-1/outreach-approvals", actorId: "maico",
    body: {
      taskId: "outreach-1", approvalId: "approval-1", workerId: "worker-acquisitions",
      message: { recipient: "test-recipient@openrabbit.local", subject: "Test opportunity", body: "Controlled test only" },
    },
  });
  assert.strictEqual(response.status, 201);
  assert.strictEqual(response.data.status, "pending");

  response = await restarted.api.handle({ method: "POST", path: "/v1/orgs/org-maico/approvals/approval-1/execute" });
  assert.strictEqual(response.status, 409);
  assert.strictEqual(response.error.code, "APPROVAL_REQUIRED");
  assert.strictEqual(response.error.retryable, false);
  assert.strictEqual(deliveries.size, 0);

  response = await restarted.api.handle({
    method: "POST", path: "/v1/orgs/other-org/approvals/approval-1/decision", actorId: "intruder",
    body: { decision: "approve" },
  });
  assert.strictEqual(response.status, 404);
  assert.strictEqual(response.error.code, "RESOURCE_NOT_FOUND");

  response = await restarted.api.handle({
    method: "POST", path: "/v1/orgs/org-maico/approvals/approval-1/decision", actorId: "maico",
    body: { decision: "approve" },
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.status, "approved");

  response = await restarted.api.handle({ method: "POST", path: "/v1/orgs/org-maico/approvals/approval-1/execute" });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.delivery.mode, "controlled_test");
  assert.strictEqual(deliveries.size, 1);

  response = await restarted.api.handle({ method: "POST", path: "/v1/orgs/org-maico/approvals/approval-1/execute" });
  assert.strictEqual(response.data.duplicate, true);
  assert.strictEqual(deliveries.size, 1);

  response = await restarted.api.handle({ method: "GET", path: "/v1/orgs/other-org/audit" });
  assert.deepStrictEqual(response.data, []);
  response = await restarted.api.handle({ method: "GET", path: "/v1/orgs/org-maico/audit" });
  assert.strictEqual(response.data.length, 4);

  console.log("Real-estate product API tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
