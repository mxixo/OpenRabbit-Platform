const assert = require("assert");
const {
  createOpenClawSkillRunner,
  getSkillCatalog,
} = require("../src/skills");

async function runTests() {
  const catalog = getSkillCatalog();
  assert.strictEqual(Array.isArray(catalog), true);
  assert.strictEqual(catalog.length >= 1, true);

  const runner = createOpenClawSkillRunner({ actor: "openclaw" });

  const investmentWorkflow = await runner.run("commercial_investment_workflow", {
    address: "100 Market St, Phoenix, AZ",
    purchasePrice: 1200000,
    annualGrossIncome: 165000,
    occupancyRate: 0.92,
    operatingExpenseRatio: 0.38,
    downPaymentPct: 0.3,
    interestRatePct: 6.75,
    amortizationYears: 25,
    units: 8,
    squareFeet: 12000,
    yearBuilt: 1999,
  });
  assert.strictEqual(investmentWorkflow.ok, true);
  assert.strictEqual(investmentWorkflow.workflow, "commercial_investment_analysis");
  assert.strictEqual(typeof investmentWorkflow.opportunityScore.score, "number");
  assert.strictEqual(typeof investmentWorkflow.investorOutreachDraft, "string");
  assert.strictEqual(
    investmentWorkflow.report.address,
    "100 Market St, Phoenix, AZ"
  );
  let threwMissingAddress = false;
  try {
    await runner.run("commercial_investment_workflow", {
      purchasePrice: 1200000,
      annualGrossIncome: 165000,
    });
  } catch (error) {
    threwMissingAddress = String(error.message).includes(
      "input.address must be a non-empty string"
    );
  }
  assert.strictEqual(threwMissingAddress, true);

  let threwUnknownSkill = false;
  try {
    await runner.run("unknown_skill", {});
  } catch (_error) {
    threwUnknownSkill = true;
  }
  assert.strictEqual(threwUnknownSkill, true);
  console.log("Commercial workflow MVP tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
