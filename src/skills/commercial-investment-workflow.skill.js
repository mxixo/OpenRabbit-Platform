const { assertObject, assertRequiredString } = require("./utils/schema");

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function yearlyDebtService({ loanAmount, interestRatePct, amortizationYears }) {
  if (!loanAmount || loanAmount <= 0) return 0;
  const monthlyRate = interestRatePct / 100 / 12;
  const periods = amortizationYears * 12;
  if (monthlyRate <= 0 || periods <= 0) return 0;
  const factor = Math.pow(1 + monthlyRate, periods);
  const monthlyPayment = (loanAmount * monthlyRate * factor) / (factor - 1);
  return monthlyPayment * 12;
}

function estimateMetrics(input) {
  const purchasePrice = toNumber(input.purchasePrice, 0);
  const annualGrossIncome = toNumber(input.annualGrossIncome, 0);
  const occupancyRate = clamp(toNumber(input.occupancyRate, 0.9), 0, 1);
  const operatingExpenseRatio = clamp(
    toNumber(input.operatingExpenseRatio, 0.35),
    0,
    1
  );
  const downPaymentPct = clamp(toNumber(input.downPaymentPct, 0.25), 0, 1);
  const interestRatePct = toNumber(input.interestRatePct, 6.5);
  const amortizationYears = Math.max(1, toNumber(input.amortizationYears, 25));

  const effectiveGrossIncome = annualGrossIncome * occupancyRate;
  const operatingExpenses = effectiveGrossIncome * operatingExpenseRatio;
  const noi = effectiveGrossIncome - operatingExpenses;
  const loanAmount = purchasePrice * (1 - downPaymentPct);
  const debtService = yearlyDebtService({
    loanAmount,
    interestRatePct,
    amortizationYears,
  });
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
  const cashInvested = purchasePrice * downPaymentPct;
  const cashFlowBeforeTax = noi - debtService;
  const cashOnCash = cashInvested > 0 ? (cashFlowBeforeTax / cashInvested) * 100 : 0;
  const dscr = debtService > 0 ? noi / debtService : 0;

  return {
    assumptions: {
      purchasePrice,
      annualGrossIncome,
      occupancyRate,
      operatingExpenseRatio,
      downPaymentPct,
      interestRatePct,
      amortizationYears,
    },
    values: {
      effectiveGrossIncome: Math.round(effectiveGrossIncome),
      operatingExpenses: Math.round(operatingExpenses),
      noi: Math.round(noi),
      annualDebtService: Math.round(debtService),
      annualCashFlowBeforeTax: Math.round(cashFlowBeforeTax),
      capRate: Number(capRate.toFixed(2)),
      cashOnCash: Number(cashOnCash.toFixed(2)),
      dscr: Number(dscr.toFixed(2)),
    },
  };
}

function scoreOpportunity(metrics) {
  const capRateScore = clamp((metrics.capRate / 8) * 100, 0, 100);
  const dscrScore = clamp((metrics.dscr / 1.5) * 100, 0, 100);
  const cashOnCashScore = clamp((metrics.cashOnCash / 12) * 100, 0, 100);

  const score = Math.round(
    capRateScore * 0.4 + dscrScore * 0.35 + cashOnCashScore * 0.25
  );
  const band = score >= 75 ? "strong" : score >= 55 ? "watch" : "weak";
  return {
    score,
    band,
    components: {
      capRateScore: Math.round(capRateScore),
      dscrScore: Math.round(dscrScore),
      cashOnCashScore: Math.round(cashOnCashScore),
    },
  };
}

function buildSummary({ address, propertyInfo, metrics, score }) {
  return `Property at ${address} shows estimated NOI of $${metrics.noi.toLocaleString()} with cap rate ${metrics.capRate}% and DSCR ${metrics.dscr}. Overall opportunity is ${score.band} (${score.score}/100).`;
}

function buildOutreachDraft({ address, metrics, score }) {
  return `Subject: Commercial opportunity review — ${address}

Hi [Investor Name],

We reviewed ${address} and estimated a cap rate of ${metrics.capRate}%, DSCR of ${metrics.dscr}, and annual pre-tax cash flow of $${metrics.annualCashFlowBeforeTax.toLocaleString()}. Current opportunity score is ${score.score}/100 (${score.band}).

If aligned with your target profile, I can share the full assumptions and next-step diligence checklist.

Best,
[Your Name]`;
}

async function gatherPropertyInfo(input) {
  const propertyInfo = {
    address: input.address,
    propertyType: input.propertyType || "commercial",
    units: toNumber(input.units, null),
    squareFeet: toNumber(input.squareFeet, null),
    yearBuilt: toNumber(input.yearBuilt, null),
    sourceNotes: [],
  };

  if (input.notes) {
    propertyInfo.sourceNotes.push(`Notes: ${input.notes}`);
  }
  propertyInfo.sourceNotes.push(
    "No direct MLS/Rentcast adapter configured in this repository; using provided inputs."
  );
  return propertyInfo;
}

async function runCommercialInvestmentWorkflow(input) {
  assertObject(input, "input");
  assertRequiredString(input.address, "input.address");

  const propertyInfo = await gatherPropertyInfo(input);
  const metricBundle = estimateMetrics(input);
  const score = scoreOpportunity(metricBundle.values);
  const investmentSummary = buildSummary({
    address: input.address,
    propertyInfo,
    metrics: metricBundle.values,
    score,
  });
  const investorOutreachDraft = buildOutreachDraft({
    address: input.address,
    metrics: metricBundle.values,
    score,
  });

  return {
    ok: true,
    workflow: "commercial_investment_analysis",
    propertyInfo,
    investmentMetrics: metricBundle.values,
    investmentSummary,
    opportunityScore: score,
    investorOutreachDraft,
    report: {
      generatedAt: new Date().toISOString(),
      address: input.address,
      propertyInfo,
      assumptions: metricBundle.assumptions,
      investmentMetrics: metricBundle.values,
      opportunityScore: score,
      investmentSummary,
      investorOutreachDraft,
    },
  };
}

module.exports = {
  name: "commercial_investment_workflow",
  description:
    "Runs a minimal commercial property investment workflow from address intake to scored investment report.",
  inputSchema: {
    type: "object",
    required: ["address"],
    properties: {
      address: { type: "string" },
      propertyType: { type: "string" },
      purchasePrice: { type: "number" },
      annualGrossIncome: { type: "number" },
      occupancyRate: { type: "number" },
      operatingExpenseRatio: { type: "number" },
      downPaymentPct: { type: "number" },
      interestRatePct: { type: "number" },
      amortizationYears: { type: "number" },
      units: { type: "number" },
      squareFeet: { type: "number" },
      yearBuilt: { type: "number" },
      notes: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      workflow: { type: "string" },
      propertyInfo: { type: "object" },
      investmentMetrics: { type: "object" },
      investmentSummary: { type: "string" },
      opportunityScore: { type: "object" },
      investorOutreachDraft: { type: "string" },
      report: { type: "object" },
    },
  },
  run: runCommercialInvestmentWorkflow,
};
