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

async function runTests() {
  const backing = createInMemoryStateBacking();
  const repository = new InMemoryRealEstateStateRepository(backing);
  const durableService = new DurableUnderwritingService({ repository });
  const outreachService = new ApprovalEnforcedOutreachService({
    repository,
    durableService,
    transport: new ControlledOutreachTransport(),
  });
  const api = new RealEstateProductApi({ durableService, repository, outreachService });

  await durableService.createDeal({
    id: "deal-workspace-1",
    orgId: "org-test",
    address: "2510 W Palo Verde Dr, Phoenix, AZ",
    propertyType: "multifamily",
  });

  let response = await api.handle({
    method: "GET",
    path: "/v1/orgs/org-test/deals/deal-workspace-1/workspace",
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.workspaceVersion, "1.0.0");
  assert.strictEqual(response.data.underwriting.status, "not_started");
  assert.strictEqual(response.data.underwriting.latestReport, null);
  assert.strictEqual(response.data.actions.canRequestOutreachApproval, false);

  await durableService.runUnderwriting({
    orgId: "org-test",
    dealId: "deal-workspace-1",
    taskId: "underwrite-workspace-1",
    input: { purchasePrice: 1600000, annualGrossIncome: 260000 },
  });
  await durableService.runUnderwriting({
    orgId: "org-test",
    dealId: "deal-workspace-1",
    taskId: "underwrite-workspace-2",
    input: { purchasePrice: 1450000, annualGrossIncome: 260000 },
  });

  const approval = await outreachService.request({
    orgId: "org-test",
    dealId: "deal-workspace-1",
    taskId: "workspace-outreach-1",
    approvalId: "workspace-approval-1",
    workerId: "worker-acquisitions",
    requestedBy: "operator",
    message: {
      recipient: "test-recipient@openrabbit.local",
      subject: "Workspace test",
      body: "Controlled workspace test",
    },
  });
  assert.strictEqual(approval.status, "pending");

  response = await api.handle({
    method: "GET",
    path: "/v1/orgs/org-test/deals/deal-workspace-1/workspace",
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.underwriting.status, "analyzed");
  assert.strictEqual(response.data.underwriting.runCount, 2);
  assert.strictEqual(response.data.underwriting.latestReport.assumptions.purchasePrice, 1450000);
  assert.deepStrictEqual(response.data.underwriting.versions.map((item) => item.version), [1, 2]);
  assert.strictEqual(response.data.approvals.length, 1);
  assert.strictEqual(response.data.actions.pendingApprovalCount, 1);
  assert.strictEqual(response.data.actions.canRequestOutreachApproval, true);
  assert.ok(Array.isArray(response.data.actions.suggestedNextActions));
  assert.ok(response.data.history.some((entry) => entry.kind === "approval_requested"));

  response = await api.handle({
    method: "GET",
    path: "/v1/orgs/other-org/deals/deal-workspace-1/workspace",
  });
  assert.strictEqual(response.status, 404);
  assert.strictEqual(response.error.code, "RESOURCE_NOT_FOUND");

  console.log("Deal workspace API tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
