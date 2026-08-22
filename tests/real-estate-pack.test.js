const assert = require("assert");
const capability = require("../capabilities/real-estate");
const realEstatePack = require("../packs/real-estate");
const legacySkill = require("../src/skills/commercial-investment-workflow.skill");

async function runTests() {
  assert.strictEqual(capability.manifest.id, "real-estate");
  assert.strictEqual(capability.manifest.version, "0.1.0");
  assert.strictEqual(capability.manifest.tools[0].name, "deal.underwrite");
  assert.strictEqual(
    capability.manifest.workflows[0].id,
    "commercial-investment"
  );

  assert.strictEqual(realEstatePack.manifest.id, "pack.real-estate");
  assert.deepStrictEqual(realEstatePack.manifest.capabilities, ["real-estate"]);
  assert.strictEqual(realEstatePack.manifest.workerPresets.length, 3);
  assert.strictEqual(
    realEstatePack.manifest.workerPresets[0].role,
    "acquisitions_analyst"
  );
  assert.strictEqual(
    realEstatePack.manifest.workerPresets[0].allowedTools[0],
    "deal.underwrite"
  );
  const leadToDealWorker = realEstatePack.manifest.workerPresets.find(
    (worker) => worker.id === "lead-to-deal-operations"
  );
  assert.ok(leadToDealWorker);
  assert.strictEqual(leadToDealWorker.role, "operations_manager");
  assert.deepStrictEqual(leadToDealWorker.allowedTools, ["deal.underwrite"]);
  assert.strictEqual(leadToDealWorker.memoryScope, "team");
  assert.strictEqual(leadToDealWorker.approvalPolicy.requiresApproval, true);
  assert.strictEqual(
    leadToDealWorker.metadata.sideEffectPolicy,
    "draft-only-until-approved"
  );

  const canonical = capability.workflows.commercialInvestmentWorkflow;
  assert.strictEqual(legacySkill, canonical);

  const result = await canonical.run({
    address: "100 Market St, Phoenix, AZ",
    purchasePrice: 1200000,
    annualGrossIncome: 165000,
    occupancyRate: 0.92,
    operatingExpenseRatio: 0.38,
    downPaymentPct: 0.3,
    interestRatePct: 6.75,
    amortizationYears: 25,
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.workflow, "commercial_investment_analysis");
  assert.strictEqual(result.report.address, "100 Market St, Phoenix, AZ");
  assert.strictEqual(typeof result.investmentMetrics.capRate, "number");
  assert.strictEqual(typeof result.opportunityScore.score, "number");

  console.log("Real Estate capability and pack tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
