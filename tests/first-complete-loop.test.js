"use strict";

const assert = require("assert");
const {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const {
  DurableUnderwritingService,
} = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const {
  ControlledOutreachTransport,
  ApprovalEnforcedOutreachService,
} = require("../capabilities/real-estate/product-api/approval-enforced-outreach");

async function runTests() {
  const backing = createInMemoryStateBacking();
  const deliveries = new Map();
  const recipient = "test-recipient@openrabbit.local";

  const repository = new InMemoryRealEstateStateRepository(backing);
  const durableService = new DurableUnderwritingService({ repository });
  const outreachService = new ApprovalEnforcedOutreachService({
    repository,
    durableService,
    transport: new ControlledOutreachTransport({
      allowedRecipients: [recipient],
      deliveries,
    }),
  });

  // 1. Create a persistent deal shell.
  const deal = await durableService.createDeal({
    id: "deal-first-complete-loop",
    orgId: "org-test",
    address: "2510 W Palo Verde Dr, Phoenix, AZ",
    propertyType: "multifamily",
  });
  assert.strictEqual(deal.status, "screening");

  // 2. Run the initial underwriting analysis with traceable assumptions.
  const firstRun = await durableService.runUnderwriting({
    orgId: "org-test",
    dealId: deal.id,
    taskId: "underwrite-v1",
    input: {
      purchasePrice: 1600000,
      annualGrossIncome: 260000,
      occupancyRate: 0.9,
      operatingExpenseRatio: 0.38,
      downPaymentPct: 0.3,
      interestRatePct: 6.75,
      amortizationYears: 25,
      targetCapRatePct: 7.5,
      rentRollProvided: true,
      trailingFinancialsProvided: true,
      debtQuoteProvided: true,
      propertyConditionReviewed: false,
      inputSources: {
        purchasePrice: { type: "broker", label: "Listing broker asking price" },
        annualGrossIncome: { type: "broker", label: "Offering memorandum" },
        occupancyRate: { type: "user", label: "Operator assumption" },
        operatingExpenseRatio: { type: "user", label: "Operator assumption" },
        downPaymentPct: { type: "user", label: "Operator financing plan" },
        interestRatePct: { type: "third_party", label: "Indicative lender quote" },
        amortizationYears: { type: "third_party", label: "Indicative lender quote" },
      },
    },
  });

  assert.strictEqual(firstRun.status, "completed");
  assert.ok(firstRun.output.report);
  assert.ok(firstRun.output.scenarios.downside);
  assert.ok(firstRun.output.scenarios.base);
  assert.ok(firstRun.output.scenarios.upside);
  assert.ok(firstRun.output.decision.recommendation);
  assert.ok(firstRun.output.decision.approvalRequiredFor.includes("send_investor_outreach"));

  // 3. Revise an assumption on the same deal and preserve version history.
  const revisedRun = await durableService.runUnderwriting({
    orgId: "org-test",
    dealId: deal.id,
    taskId: "underwrite-v2",
    input: {
      purchasePrice: 1450000,
      annualGrossIncome: 260000,
      occupancyRate: 0.9,
      operatingExpenseRatio: 0.38,
      downPaymentPct: 0.3,
      interestRatePct: 6.75,
      amortizationYears: 25,
      targetCapRatePct: 7.5,
      rentRollProvided: true,
      trailingFinancialsProvided: true,
      debtQuoteProvided: true,
      propertyConditionReviewed: true,
    },
  });

  assert.strictEqual(revisedRun.status, "completed");
  const runs = await durableService.listRuns("org-test", deal.id);
  assert.deepStrictEqual(runs.map((run) => run.version), [1, 2]);
  assert.strictEqual(runs[0].report.assumptions.purchasePrice, 1600000);
  assert.strictEqual(runs[1].report.assumptions.purchasePrice, 1450000);
  assert.notStrictEqual(
    firstRun.output.investmentMetrics.capRate,
    revisedRun.output.investmentMetrics.capRate
  );

  // 4. Turn the recommendation into a controlled external action request.
  const approval = await outreachService.request({
    orgId: "org-test",
    dealId: deal.id,
    taskId: "investor-outreach-1",
    approvalId: "approval-outreach-1",
    workerId: "worker-acquisitions",
    requestedBy: "operator-test",
    message: {
      recipient,
      subject: `Investment review — ${deal.address}`,
      body: revisedRun.output.outreachDraft,
    },
  });
  assert.strictEqual(approval.status, "pending");

  // 5. Prove the action cannot execute without human approval.
  await assert.rejects(
    () => outreachService.execute({ orgId: "org-test", approvalId: approval.id }),
    /execution requires approved/
  );
  assert.strictEqual(deliveries.size, 0);

  // 6. Approve and execute exactly once.
  const approved = await outreachService.decide({
    orgId: "org-test",
    approvalId: approval.id,
    decision: "approve",
    decidedBy: "operator-test",
  });
  assert.strictEqual(approved.status, "approved");

  const execution = await outreachService.execute({
    orgId: "org-test",
    approvalId: approval.id,
  });
  assert.strictEqual(execution.status, "completed");
  assert.strictEqual(execution.delivery.mode, "controlled_test");
  assert.strictEqual(deliveries.size, 1);

  // 7. Repeating the same task is idempotent and does not create a second delivery.
  const duplicateExecution = await outreachService.execute({
    orgId: "org-test",
    approvalId: approval.id,
  });
  assert.strictEqual(duplicateExecution.duplicate, true);
  assert.strictEqual(deliveries.size, 1);

  // 8. Simulate a restart and reload the deal, report history, approval, and audit trail.
  const repositoryAfterRestart = new InMemoryRealEstateStateRepository(backing);
  const durableServiceAfterRestart = new DurableUnderwritingService({
    repository: repositoryAfterRestart,
  });

  const reloadedDeal = await durableServiceAfterRestart.getDeal("org-test", deal.id);
  const reloadedRuns = await durableServiceAfterRestart.listRuns("org-test", deal.id);
  const reloadedApproval = await repositoryAfterRestart.getApproval("org-test", approval.id);
  const audit = await repositoryAfterRestart.listAudit("org-test");

  assert.strictEqual(reloadedDeal.address, deal.address);
  assert.strictEqual(reloadedRuns.length, 2);
  assert.strictEqual(reloadedRuns[1].report.assumptions.purchasePrice, 1450000);
  assert.strictEqual(reloadedApproval.status, "approved");
  assert.ok(audit.some((entry) => entry.kind === "approval_requested"));
  assert.ok(audit.some((entry) => entry.kind === "approval_approved"));
  assert.ok(
    audit.some(
      (entry) =>
        entry.kind === "task_completed" &&
        entry.action === "send_investor_outreach" &&
        entry.outcome === "completed"
    )
  );

  // 9. Tenant boundaries remain intact across the complete flow.
  assert.strictEqual(await durableServiceAfterRestart.getDeal("other-org", deal.id), undefined);
  assert.deepStrictEqual(await durableServiceAfterRestart.listRuns("other-org", deal.id), []);
  assert.strictEqual(await repositoryAfterRestart.getApproval("other-org", approval.id), undefined);
  assert.deepStrictEqual(await repositoryAfterRestart.listAudit("other-org"), []);

  console.log("First complete underwriting loop test passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
