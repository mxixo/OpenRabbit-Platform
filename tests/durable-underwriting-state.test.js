"use strict";

const assert = require("assert");
const {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const {
  DurableUnderwritingService,
} = require("../capabilities/real-estate/persistence/durable-underwriting-service");

async function runTests() {
  const backing = createInMemoryStateBacking();
  const repositoryBeforeRestart = new InMemoryRealEstateStateRepository(backing);
  const serviceBeforeRestart = new DurableUnderwritingService({ repository: repositoryBeforeRestart });

  await serviceBeforeRestart.createDeal({
    id: "deal-royal-inn",
    orgId: "org-maico",
    address: "2510 W Palo Verde Dr, Phoenix, AZ",
    propertyType: "multifamily",
  });

  const first = await serviceBeforeRestart.runUnderwriting({
    orgId: "org-maico",
    dealId: "deal-royal-inn",
    taskId: "underwrite-1",
    input: { purchasePrice: 1600000, annualGrossIncome: 260000 },
  });
  assert.strictEqual(first.status, "completed");

  const repositoryAfterRestart = new InMemoryRealEstateStateRepository(backing);
  const serviceAfterRestart = new DurableUnderwritingService({ repository: repositoryAfterRestart });
  assert.strictEqual((await serviceAfterRestart.getDeal("org-maico", "deal-royal-inn")).address, "2510 W Palo Verde Dr, Phoenix, AZ");
  assert.strictEqual((await serviceAfterRestart.listRuns("org-maico", "deal-royal-inn")).length, 1);

  const duplicate = await serviceAfterRestart.runUnderwriting({
    orgId: "org-maico",
    dealId: "deal-royal-inn",
    taskId: "underwrite-1",
    input: { purchasePrice: 999, annualGrossIncome: 999 },
  });
  assert.strictEqual(duplicate.duplicate, true);
  assert.strictEqual((await serviceAfterRestart.listRuns("org-maico", "deal-royal-inn")).length, 1);

  await serviceAfterRestart.runUnderwriting({
    orgId: "org-maico",
    dealId: "deal-royal-inn",
    taskId: "underwrite-2",
    input: { purchasePrice: 1500000, annualGrossIncome: 260000 },
  });
  const versions = await serviceAfterRestart.listRuns("org-maico", "deal-royal-inn");
  assert.deepStrictEqual(versions.map((run) => run.version), [1, 2]);
  assert.strictEqual(versions[0].report.assumptions.purchasePrice, 1600000);
  assert.strictEqual(versions[1].report.assumptions.purchasePrice, 1500000);

  assert.strictEqual(await serviceAfterRestart.getDeal("other-org", "deal-royal-inn"), undefined);
  assert.deepStrictEqual(await serviceAfterRestart.listRuns("other-org", "deal-royal-inn"), []);

  const approval = await serviceAfterRestart.requestApproval({
    id: "approval-1",
    orgId: "org-maico",
    workerId: "worker-acquisitions",
    taskId: "outreach-1",
    taskType: "send_investor_outreach",
    input: { dealId: "deal-royal-inn" },
    policyId: "human-approval",
  });
  assert.strictEqual(approval.status, "pending");
  const decided = await serviceAfterRestart.decideApproval({
    orgId: "org-maico",
    approvalId: "approval-1",
    decision: "approve",
    decidedBy: "maico",
  });
  assert.strictEqual(decided.status, "approved");
  assert.strictEqual(decided.decidedBy, "maico");
  assert.strictEqual((await repositoryAfterRestart.listAudit("org-maico")).length, 4);
  assert.deepStrictEqual(await repositoryAfterRestart.listAudit("other-org"), []);

  console.log("Durable underwriting state tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
