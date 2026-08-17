"use strict";

const assert = require("assert");
const workflow = require("../capabilities/real-estate/workflows/commercial-investment-workflow");
const {
  CONTRACT_VERSION,
  underwritingInputSchema,
  underwritingReportSchema,
  validateUnderwritingReport,
} = require("../capabilities/real-estate/contracts/underwriting-contract");

async function runTests() {
  assert.strictEqual(workflow.contractVersion, CONTRACT_VERSION);
  assert.deepStrictEqual(workflow.inputSchema, underwritingInputSchema);
  assert.strictEqual(workflow.outputSchema.properties.report, underwritingReportSchema);

  const result = await workflow.run({
    address: "2510 W Palo Verde Dr, Phoenix, AZ",
    propertyType: "multifamily",
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
    propertyConditionReviewed: true,
    inputSources: {
      purchasePrice: { type: "broker", label: "Listing broker" },
      annualGrossIncome: { type: "broker", label: "Offering memorandum" },
      occupancyRate: { type: "user", label: "Operator assumption" },
      operatingExpenseRatio: { type: "user", label: "Operator assumption" },
      downPaymentPct: { type: "user", label: "Financing plan" },
      interestRatePct: { type: "third_party", label: "Lender indication" },
      amortizationYears: { type: "third_party", label: "Lender indication" },
    },
  });

  assert.strictEqual(result.contractVersion, CONTRACT_VERSION);
  assert.strictEqual(result.report.contractVersion, CONTRACT_VERSION);
  assert.deepStrictEqual(validateUnderwritingReport(result.report), []);
  assert.deepStrictEqual(Object.keys(result.report.scenarios).sort(), ["base", "downside", "upside"]);
  assert.ok(["low", "medium", "high"].includes(result.report.dataQuality.confidence));
  assert.ok(["strong", "watch", "weak"].includes(result.report.opportunityScore.band));
  assert.ok(result.report.decision.approvalRequiredFor.includes("send_investor_outreach"));

  const invalid = { ...result.report, scenarios: { base: result.report.scenarios.base } };
  const failures = validateUnderwritingReport(invalid);
  assert.ok(failures.includes("report.scenarios.downside is required"));
  assert.ok(failures.includes("report.scenarios.upside is required"));

  console.log("Canonical underwriting contract tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
