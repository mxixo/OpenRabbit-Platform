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
  const deliveries = new Map();
  const outreachService = new ApprovalEnforcedOutreachService({
    repository,
    durableService,
    transport: new ControlledOutreachTransport({ deliveries }),
  });
  const api = new RealEstateProductApi({ durableService, repository, outreachService });

  let response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/deals",
    body: { id: "deal-ui", address: "2510 W Palo Verde Dr, Phoenix, AZ", propertyType: "multifamily" },
  });
  assert.strictEqual(response.status, 201);

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/deals/deal-ui/underwriting-runs",
    body: { taskId: "underwrite-ui-1", input: { purchasePrice: 1600000, annualGrossIncome: 260000 } },
  });
  assert.strictEqual(response.status, 201);

  response = await api.handle({ method: "GET", path: "/v1/orgs/org-ui/deals/deal-ui/workspace" });
  const firstWorkspace = response.data;
  assert.strictEqual(firstWorkspace.summary.runCount, 1);
  assert.strictEqual(firstWorkspace.latestReport.assumptions.purchasePrice, 1600000);

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/deals/deal-ui/underwriting-runs",
    body: {
      taskId: "underwrite-ui-2",
      input: { ...firstWorkspace.latestReport.assumptions, purchasePrice: 1450000, annualGrossIncome: 275000 },
    },
  });
  assert.strictEqual(response.status, 201);

  response = await api.handle({ method: "GET", path: "/v1/orgs/org-ui/deals/deal-ui/workspace" });
  const revised = response.data;
  assert.strictEqual(revised.summary.runCount, 2);
  assert.strictEqual(revised.latestReport.assumptions.purchasePrice, 1450000);
  assert.strictEqual(revised.latestReport.assumptions.annualGrossIncome, 275000);

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/deals/deal-ui/outreach-approvals",
    actorId: "operator-ui",
    body: {
      taskId: "outreach-ui-1",
      approvalId: "approval-ui-1",
      workerId: "workspace-operator",
      message: {
        recipient: "test-recipient@openrabbit.local",
        subject: "Investment review",
        body: revised.latestReport.investorOutreachDraft,
      },
    },
  });
  assert.strictEqual(response.status, 201);
  assert.strictEqual(response.data.status, "pending");

  response = await api.handle({ method: "GET", path: "/v1/orgs/org-ui/deals/deal-ui/workspace" });
  assert.strictEqual(response.data.summary.pendingApprovalCount, 1);
  assert.strictEqual(response.data.nextActions.canRequestOutreachApproval, false);

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/approvals/approval-ui-1/decision",
    actorId: "operator-ui",
    body: { decision: "approve" },
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.status, "approved");

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/approvals/approval-ui-1/execute",
    actorId: "operator-ui",
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.status, "completed");
  assert.strictEqual(deliveries.size, 1);

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/deals/deal-ui/outreach-approvals",
    actorId: "operator-ui",
    body: {
      taskId: "outreach-ui-2",
      approvalId: "approval-ui-2",
      workerId: "workspace-operator",
      message: {
        recipient: "test-recipient@openrabbit.local",
        subject: "Second investment review",
        body: revised.latestReport.investorOutreachDraft,
      },
    },
  });
  assert.strictEqual(response.status, 201);

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/approvals/approval-ui-2/decision",
    actorId: "operator-ui",
    body: { decision: "deny" },
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.status, "denied");

  response = await api.handle({
    method: "POST",
    path: "/v1/orgs/org-ui/approvals/approval-ui-2/execute",
    actorId: "operator-ui",
  });
  assert.strictEqual(response.status, 409);
  assert.strictEqual(deliveries.size, 1);

  response = await api.handle({ method: "GET", path: "/v1/orgs/org-ui/deals/deal-ui/workspace" });
  assert.strictEqual(response.data.summary.approvedApprovalCount, 1);
  assert.ok(response.data.audit.some((entry) => entry.action === "send_investor_outreach" && entry.outcome === "completed"));
  assert.ok(response.data.audit.some((entry) => entry.kind === "approval_denied"));

  console.log("Deal workspace action tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
