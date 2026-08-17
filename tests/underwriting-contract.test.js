"use strict";

const assert = require("assert");
const {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const { DurableUnderwritingService } = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const {
  CONTRACT_VERSION,
  underwritingInputSchema,
  underwritingReportSchema,
  validateUnderwritingReport,
} = require("../capabilities/real-estate/contracts/underwriting-contract");

async function runTests() {
  assert.strictEqual(underwritingInputSchema.required.includes("purchasePrice"), true);
  assert.strictEqual(underwritingReportSchema.required.includes("contractVersion"), true);

  const repository = new InMemoryRealEstateStateRepository(createInMemoryStateBacking());
  const service = new DurableUnderwritingService({ repository });
  await service.createDeal({
    id: "deal-contract",
    orgId: "org-contract",
    address: "2510 W Palo Verde Dr, Phoenix, AZ",
    propertyType: "multifamily",
  });

  const result = await service.runUnderwriting({
    orgId: "org-contract",
    dealId: "deal-contract",
    taskId: "underwrite-contract",
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
    },
  });

  assert.strictEqual(result.output.contractVersion, CONTRACT_VERSION);
  assert.strictEqual(result.output.report.contractVersion, CONTRACT_VERSION);
  assert.deepStrictEqual(validateUnderwritingReport(result.output.report), []);
  assert.deepStrictEqual(Object.keys(result.output.report.scenarios).sort(), ["base", "downside", "upside"]);
  assert.ok(result.output.report.decision.approvalRequiredFor.includes("send_investor_outreach"));

  const invalid = { ...result.output.report, scenarios: { base: result.output.report.scenarios.base } };
  const failures = validateUnderwritingReport(invalid);
  assert.ok(failures.includes("report.scenarios.downside is required"));
  assert.ok(failures.includes("report.scenarios.upside is required"));

  console.log("Canonical underwriting contract tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
