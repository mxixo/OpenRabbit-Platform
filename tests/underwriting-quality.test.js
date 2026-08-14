"use strict";

const assert = require("assert");
const workflow = require("../capabilities/real-estate/workflows/commercial-investment-workflow");

async function runTests() {
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
  });

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(Object.keys(result.scenarios), ["downside", "base", "upside"]);
  assert.ok(
    result.scenarios.downside.investmentMetrics.annualCashFlowBeforeTax <
      result.scenarios.base.investmentMetrics.annualCashFlowBeforeTax
  );
  assert.ok(
    result.scenarios.upside.investmentMetrics.annualCashFlowBeforeTax >
      result.scenarios.base.investmentMetrics.annualCashFlowBeforeTax
  );
  assert.strictEqual(result.dataQuality.confidence, "high");
  assert.strictEqual(result.dataQuality.sourceCoveragePct, 100);
  assert.ok(result.dataQuality.diligenceItems.some((item) => item.includes("condition")));
  assert.ok(Number.isFinite(result.decision.targetPurchasePrice));
  assert.ok(Array.isArray(result.decision.rationale));
  assert.ok(result.decision.approvalRequiredFor.includes("send_investor_outreach"));
  assert.deepStrictEqual(result.report.decision, result.decision);

  const lowConfidence = await workflow.run({
    address: "100 Test Ave, Phoenix, AZ",
    purchasePrice: 1000000,
    annualGrossIncome: 150000,
  });
  assert.strictEqual(lowConfidence.dataQuality.confidence, "low");
  assert.strictEqual(lowConfidence.decision.recommendation, "request_information");
  assert.ok(lowConfidence.dataQuality.defaultAssumptionsUsed.includes("occupancyRate"));

  const documentedButUnsourced = await workflow.run({
    address: "200 Test Ave, Phoenix, AZ",
    purchasePrice: 1000000,
    annualGrossIncome: 150000,
    occupancyRate: 0.9,
    operatingExpenseRatio: 0.35,
    downPaymentPct: 0.25,
    interestRatePct: 6.5,
    amortizationYears: 25,
    rentRollProvided: true,
    trailingFinancialsProvided: true,
    debtQuoteProvided: true,
  });
  assert.strictEqual(documentedButUnsourced.dataQuality.confidence, "medium");
  assert.ok(
    documentedButUnsourced.dataQuality.warnings.some((warning) =>
      warning.includes("source metadata")
    )
  );

  const zeroInterest = await workflow.run({
    address: "300 Test Ave, Phoenix, AZ",
    purchasePrice: 1000000,
    annualGrossIncome: 150000,
    downPaymentPct: 0.2,
    interestRatePct: 0,
    amortizationYears: 20,
  });
  assert.strictEqual(zeroInterest.investmentMetrics.annualDebtService, 40000);

  const invalidInputs = [
    [{ address: "100 Test Ave", annualGrossIncome: 100000 }, "input.purchasePrice is required"],
    [{ address: "100 Test Ave", purchasePrice: 1000000 }, "input.annualGrossIncome is required"],
    [
      { address: "100 Test Ave", purchasePrice: 1000000, annualGrossIncome: 100000, occupancyRate: 1.2 },
      "input.occupancyRate must be no greater than 1",
    ],
    [
      { address: "100 Test Ave", purchasePrice: -1, annualGrossIncome: 100000 },
      "input.purchasePrice must be greater than 0",
    ],
    [
      {
        address: "100 Test Ave",
        purchasePrice: 1000000,
        annualGrossIncome: 100000,
        inputSources: { purchasePrice: { type: "made_up" } },
      },
      "input.inputSources.purchasePrice.type is invalid",
    ],
  ];

  for (const [input, message] of invalidInputs) {
    await assert.rejects(() => workflow.run(input), new RegExp(message.replace(/[.]/g, "\\.")));
  }

  console.log("Underwriting quality tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
