"use strict";

const CONTRACT_VERSION = "1.0.0";

const sourceTypeSchema = {
  type: "string",
  enum: ["user", "broker", "public_record", "third_party", "estimate"],
};

const assumptionsSchema = {
  type: "object",
  required: [
    "purchasePrice",
    "annualGrossIncome",
    "occupancyRate",
    "operatingExpenseRatio",
    "downPaymentPct",
    "interestRatePct",
    "amortizationYears",
    "targetCapRatePct",
  ],
  properties: {
    purchasePrice: { type: "number", exclusiveMinimum: 0 },
    annualGrossIncome: { type: "number", exclusiveMinimum: 0 },
    occupancyRate: { type: "number", minimum: 0, maximum: 1 },
    operatingExpenseRatio: { type: "number", minimum: 0, maximum: 0.95 },
    downPaymentPct: { type: "number", minimum: 0, maximum: 1 },
    interestRatePct: { type: "number", minimum: 0, maximum: 30 },
    amortizationYears: { type: "number", minimum: 1, maximum: 50 },
    targetCapRatePct: { type: "number", exclusiveMinimum: 0, maximum: 100 },
  },
};

const investmentMetricsSchema = {
  type: "object",
  required: [
    "effectiveGrossIncome",
    "operatingExpenses",
    "noi",
    "annualDebtService",
    "annualCashFlowBeforeTax",
    "capRate",
    "cashOnCash",
    "dscr",
  ],
  properties: {
    effectiveGrossIncome: { type: "number" },
    operatingExpenses: { type: "number" },
    noi: { type: "number" },
    annualDebtService: { type: "number" },
    annualCashFlowBeforeTax: { type: "number" },
    capRate: { type: "number" },
    cashOnCash: { type: "number" },
    dscr: { type: "number" },
  },
};

const scenarioSchema = {
  type: "object",
  required: ["assumptions", "investmentMetrics"],
  properties: {
    assumptions: assumptionsSchema,
    investmentMetrics: investmentMetricsSchema,
  },
};

const provenanceEntrySchema = {
  type: "object",
  required: ["type", "label", "observedAt"],
  properties: {
    type: sourceTypeSchema,
    label: { type: "string" },
    observedAt: { type: ["string", "null"] },
  },
};

const dataQualitySchema = {
  type: "object",
  required: [
    "confidence",
    "sourceCoveragePct",
    "provenance",
    "warnings",
    "diligenceItems",
    "defaultAssumptionsUsed",
    "evaluatedAssumptions",
  ],
  properties: {
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    sourceCoveragePct: { type: "number", minimum: 0, maximum: 100 },
    provenance: { type: "object", additionalProperties: provenanceEntrySchema },
    warnings: { type: "array", items: { type: "string" } },
    diligenceItems: { type: "array", items: { type: "string" } },
    defaultAssumptionsUsed: { type: "array", items: { type: "string" } },
    evaluatedAssumptions: assumptionsSchema,
  },
};

const decisionSchema = {
  type: "object",
  required: [
    "recommendation",
    "targetPurchasePrice",
    "targetCapRatePct",
    "rationale",
    "suggestedNextActions",
    "approvalRequiredFor",
  ],
  properties: {
    recommendation: {
      type: "string",
      enum: ["reject", "request_information", "pursue_diligence", "pursue_below_target_price"],
    },
    targetPurchasePrice: { type: "number" },
    targetCapRatePct: { type: "number" },
    rationale: { type: "array", items: { type: "string" } },
    suggestedNextActions: { type: "array", items: { type: "string" } },
    approvalRequiredFor: { type: "array", items: { type: "string" } },
  },
};

const opportunityScoreSchema = {
  type: "object",
  required: ["score", "band", "components"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    band: { type: "string", enum: ["strong", "watch", "weak"] },
    components: {
      type: "object",
      required: ["capRateScore", "dscrScore", "cashOnCashScore"],
      properties: {
        capRateScore: { type: "number" },
        dscrScore: { type: "number" },
        cashOnCashScore: { type: "number" },
      },
    },
  },
};

const underwritingInputSchema = {
  type: "object",
  required: ["address", "purchasePrice", "annualGrossIncome"],
  properties: {
    address: { type: "string", minLength: 1 },
    propertyType: { type: "string" },
    purchasePrice: { type: "number", exclusiveMinimum: 0 },
    annualGrossIncome: { type: "number", exclusiveMinimum: 0 },
    occupancyRate: { type: "number", minimum: 0, maximum: 1 },
    operatingExpenseRatio: { type: "number", minimum: 0, maximum: 0.95 },
    downPaymentPct: { type: "number", minimum: 0, maximum: 1 },
    interestRatePct: { type: "number", minimum: 0, maximum: 30 },
    amortizationYears: { type: "number", minimum: 1, maximum: 50 },
    targetCapRatePct: { type: "number", exclusiveMinimum: 0, maximum: 100 },
    units: { type: "number" },
    squareFeet: { type: "number" },
    yearBuilt: { type: "number" },
    notes: { type: "string" },
    locationRadiusMeters: { type: "number" },
    inputSources: { type: "object" },
    rentRollProvided: { type: "boolean" },
    trailingFinancialsProvided: { type: "boolean" },
    debtQuoteProvided: { type: "boolean" },
    propertyConditionReviewed: { type: "boolean" },
  },
};

const underwritingReportSchema = {
  type: "object",
  required: [
    "contractVersion",
    "generatedAt",
    "address",
    "propertyInfo",
    "assumptions",
    "investmentMetrics",
    "opportunityScore",
    "scenarios",
    "dataQuality",
    "decision",
    "investmentSummary",
    "investorOutreachDraft",
  ],
  properties: {
    contractVersion: { type: "string", const: CONTRACT_VERSION },
    generatedAt: { type: "string" },
    address: { type: "string" },
    propertyInfo: { type: "object" },
    assumptions: assumptionsSchema,
    investmentMetrics: investmentMetricsSchema,
    opportunityScore: opportunityScoreSchema,
    scenarios: {
      type: "object",
      required: ["downside", "base", "upside"],
      properties: { downside: scenarioSchema, base: scenarioSchema, upside: scenarioSchema },
    },
    dataQuality: dataQualitySchema,
    decision: decisionSchema,
    investmentSummary: { type: "string" },
    investorOutreachDraft: { type: "string" },
  },
};

function validateUnderwritingReport(report) {
  const failures = [];
  const requireObject = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) failures.push(`${path} must be an object`);
  };
  requireObject(report, "report");
  if (failures.length) return failures;
  if (report.contractVersion !== CONTRACT_VERSION) failures.push("report.contractVersion is invalid");
  if (typeof report.generatedAt !== "string" || !report.generatedAt) failures.push("report.generatedAt is required");
  if (typeof report.address !== "string" || !report.address) failures.push("report.address is required");
  requireObject(report.assumptions, "report.assumptions");
  requireObject(report.investmentMetrics, "report.investmentMetrics");
  requireObject(report.opportunityScore, "report.opportunityScore");
  requireObject(report.scenarios, "report.scenarios");
  requireObject(report.dataQuality, "report.dataQuality");
  requireObject(report.decision, "report.decision");
  for (const name of ["downside", "base", "upside"]) {
    if (!report.scenarios?.[name]) failures.push(`report.scenarios.${name} is required`);
  }
  if (typeof report.investmentSummary !== "string") failures.push("report.investmentSummary must be a string");
  if (typeof report.investorOutreachDraft !== "string") failures.push("report.investorOutreachDraft must be a string");
  return failures;
}

module.exports = {
  CONTRACT_VERSION,
  underwritingInputSchema,
  underwritingReportSchema,
  assumptionsSchema,
  investmentMetricsSchema,
  opportunityScoreSchema,
  dataQualitySchema,
  decisionSchema,
  validateUnderwritingReport,
};
