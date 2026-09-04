"use strict";

const { assertObject, assertRequiredString } = require("../utils/schema");

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function requireNumber(input, field, options = {}) {
  const value = input[field];
  if (value === undefined || value === null || value === "") {
    throw new Error(`input.${field} is required`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`input.${field} must be a finite number`);
  }
  if (options.exclusiveMin !== undefined && number <= options.exclusiveMin) {
    throw new Error(`input.${field} must be greater than ${options.exclusiveMin}`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new Error(`input.${field} must be at least ${options.min}`);
  }
  if (options.max !== undefined && number > options.max) {
    throw new Error(`input.${field} must be no greater than ${options.max}`);
  }
  return number;
}

function optionalNumber(input, field, options = {}) {
  if (input[field] === undefined || input[field] === null || input[field] === "") {
    return options.fallback ?? null;
  }
  return requireNumber(input, field, options);
}

function validateInputs(input) {
  return {
    purchasePrice: requireNumber(input, "purchasePrice", { exclusiveMin: 0 }),
    annualGrossIncome: requireNumber(input, "annualGrossIncome", { exclusiveMin: 0 }),
    occupancyRate: optionalNumber(input, "occupancyRate", { min: 0, max: 1, fallback: 0.9 }),
    operatingExpenseRatio: optionalNumber(input, "operatingExpenseRatio", {
      min: 0,
      max: 0.95,
      fallback: 0.35,
    }),
    downPaymentPct: optionalNumber(input, "downPaymentPct", { min: 0, max: 1, fallback: 0.25 }),
    interestRatePct: optionalNumber(input, "interestRatePct", { min: 0, max: 30, fallback: 6.5 }),
    amortizationYears: optionalNumber(input, "amortizationYears", { min: 1, max: 50, fallback: 25 }),
    targetCapRatePct: optionalNumber(input, "targetCapRatePct", {
      exclusiveMin: 0,
      max: 100,
      fallback: 7.5,
    }),
  };
}

function yearlyDebtService({ loanAmount, interestRatePct, amortizationYears }) {
  if (!loanAmount || loanAmount <= 0) return 0;
  const monthlyRate = interestRatePct / 100 / 12;
  const periods = amortizationYears * 12;
  if (periods <= 0) return 0;
  if (monthlyRate === 0) return (loanAmount / periods) * 12;
  const factor = Math.pow(1 + monthlyRate, periods);
  const monthlyPayment = (loanAmount * monthlyRate * factor) / (factor - 1);
  return monthlyPayment * 12;
}

function estimateMetrics(assumptions) {
  const {
    purchasePrice,
    annualGrossIncome,
    occupancyRate,
    operatingExpenseRatio,
    downPaymentPct,
    interestRatePct,
    amortizationYears,
  } = assumptions;

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
      occupancyRate: Number(occupancyRate.toFixed(4)),
      operatingExpenseRatio: Number(operatingExpenseRatio.toFixed(4)),
      downPaymentPct: Number(downPaymentPct.toFixed(4)),
      interestRatePct: Number(interestRatePct.toFixed(4)),
      amortizationYears,
      targetCapRatePct: assumptions.targetCapRatePct,
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

function buildScenarios(baseAssumptions) {
  const definitions = {
    downside: {
      ...baseAssumptions,
      occupancyRate: clamp(baseAssumptions.occupancyRate - 0.1, 0.5, 1),
      operatingExpenseRatio: clamp(baseAssumptions.operatingExpenseRatio + 0.05, 0, 0.95),
      interestRatePct: baseAssumptions.interestRatePct + 1,
    },
    base: { ...baseAssumptions },
    upside: {
      ...baseAssumptions,
      occupancyRate: clamp(baseAssumptions.occupancyRate + 0.05, 0, 1),
      operatingExpenseRatio: clamp(baseAssumptions.operatingExpenseRatio - 0.03, 0, 0.95),
      interestRatePct: Math.max(0, baseAssumptions.interestRatePct - 0.5),
    },
  };

  return Object.fromEntries(
    Object.entries(definitions).map(([name, assumptions]) => {
      const bundle = estimateMetrics(assumptions);
      return [name, { assumptions: bundle.assumptions, investmentMetrics: bundle.values }];
    })
  );
}

const SOURCE_TYPES = new Set([
  "user",
  "broker",
  "public_record",
  "third_party",
  "estimate",
]);

function buildDataQuality(input, assumptions) {
  const suppliedSources = input.inputSources && typeof input.inputSources === "object"
    ? input.inputSources
    : {};
  const importantFields = [
    "purchasePrice",
    "annualGrossIncome",
    "occupancyRate",
    "operatingExpenseRatio",
    "downPaymentPct",
    "interestRatePct",
    "amortizationYears",
  ];
  const provenance = {};
  const warnings = [];
  let sourcedCount = 0;

  for (const field of importantFields) {
    const supplied = suppliedSources[field];
    const type = supplied?.type || (input[field] === undefined ? "estimate" : "user");
    if (!SOURCE_TYPES.has(type)) {
      throw new Error(`input.inputSources.${field}.type is invalid`);
    }
    provenance[field] = {
      type,
      label: supplied?.label || (type === "estimate" ? "OpenRabbit default assumption" : "Operator-provided input"),
      observedAt: supplied?.observedAt || null,
    };
    if (supplied) sourcedCount += 1;
    if (type === "estimate") warnings.push(`${field} uses a default estimate and should be verified.`);
  }

  if (!input.rentRollProvided) warnings.push("Current rent roll has not been confirmed.");
  if (!input.trailingFinancialsProvided) warnings.push("Trailing operating statements have not been confirmed.");
  if (!input.debtQuoteProvided) warnings.push("Financing terms are assumptions, not a lender quote.");

  const diligenceItems = [
    !input.rentRollProvided && "Obtain and reconcile the current rent roll.",
    !input.trailingFinancialsProvided && "Obtain trailing 12-month income and operating expenses.",
    !input.debtQuoteProvided && "Obtain a lender quote and rerun debt-service assumptions.",
    !input.propertyConditionReviewed && "Review property condition, deferred maintenance, and capital needs.",
  ].filter(Boolean);

  const sourceCoveragePct = Math.round((sourcedCount / importantFields.length) * 100);
  if (sourceCoveragePct === 0) {
    warnings.push("No field-level source metadata was supplied for the financial inputs.");
  }
  const confidence = warnings.length >= 4
    ? "low"
    : warnings.length <= 1 && sourceCoveragePct >= 70
      ? "high"
      : "medium";
  return {
    confidence,
    sourceCoveragePct,
    provenance,
    warnings,
    diligenceItems,
    defaultAssumptionsUsed: Object.keys(provenance).filter(
      (field) => provenance[field].type === "estimate"
    ),
    evaluatedAssumptions: assumptions,
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

function buildSummary({ address, metrics, score }) {
  return `Property at ${address} shows estimated NOI of $${metrics.noi.toLocaleString()} with cap rate ${metrics.capRate}% and DSCR ${metrics.dscr}. Overall opportunity is ${score.band} (${score.score}/100).`;
}

function buildDecision({ metrics, score, dataQuality, targetCapRatePct }) {
  const targetPurchasePrice = Math.round(metrics.noi / (targetCapRatePct / 100));
  let recommendation = "reject";
  if (dataQuality.confidence === "low") recommendation = "request_information";
  else if (score.band === "strong") recommendation = "pursue_diligence";
  else if (score.band === "watch") recommendation = "pursue_below_target_price";

  const rationale = [
    `Opportunity score is ${score.score}/100 (${score.band}).`,
    `Base DSCR is ${metrics.dscr} and annual pre-tax cash flow is $${metrics.annualCashFlowBeforeTax.toLocaleString()}.`,
    `Data confidence is ${dataQuality.confidence}.`,
  ];

  return {
    recommendation,
    targetPurchasePrice,
    targetCapRatePct,
    rationale,
    suggestedNextActions: dataQuality.diligenceItems.length
      ? dataQuality.diligenceItems
      : ["Confirm investment criteria with the operator before external outreach."],
    approvalRequiredFor: ["crm_write", "send_investor_outreach", "contact_listing_broker"],
  };
}

function buildOutreachDraft({ address, metrics, score }) {
  return `Subject: Commercial opportunity review — ${address}

Hi [Investor Name],

We reviewed ${address} and estimated a cap rate of ${metrics.capRate}%, DSCR of ${metrics.dscr}, and annual pre-tax cash flow of $${metrics.annualCashFlowBeforeTax.toLocaleString()}. Current opportunity score is ${score.score}/100 (${score.band}).

If aligned with your target profile, I can share the full assumptions and next-step diligence checklist.

Best,
[Your Name]`;
}

async function fetchCaminoContextByAddress({ address, radius = 1000 }) {
  const apiKey = process.env.CAMINO_API_KEY;
  if (!apiKey) return null;
  if (typeof fetch !== "function") return null;

  const geocodeUrl = `https://api.getcamino.ai/query?query=${encodeURIComponent(
    address
  )}&limit=1`;
  const geocodeRes = await fetch(geocodeUrl, {
    headers: {
      "X-API-Key": apiKey,
    },
  });
  if (!geocodeRes.ok) return null;
  const geocodeBody = await geocodeRes.json();
  const first =
    geocodeBody?.results?.[0] ||
    geocodeBody?.items?.[0] ||
    geocodeBody?.data?.[0] ||
    null;
  if (!first) return null;

  const lat =
    first.lat ??
    first.latitude ??
    first.location?.lat ??
    first.location?.latitude ??
    null;
  const lon =
    first.lon ??
    first.lng ??
    first.longitude ??
    first.location?.lon ??
    first.location?.lng ??
    first.location?.longitude ??
    null;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;

  const contextRes = await fetch("https://api.getcamino.ai/context", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location: {
        lat: Number(lat),
        lon: Number(lon),
      },
      radius,
      context:
        "commercial real estate investment evaluation: transit, grocery, restaurants, parks, neighborhood context, walkability",
    }),
  });
  if (!contextRes.ok) return null;
  return contextRes.json();
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
  const contextRadius = Math.max(250, toNumber(input.locationRadiusMeters, 1000));
  const caminoContext = await fetchCaminoContextByAddress({
    address: input.address,
    radius: contextRadius,
  });
  if (caminoContext) {
    propertyInfo.locationContext = caminoContext;
    propertyInfo.sourceNotes.push("Location context added via Camino API.");
  }

  if (input.notes) {
    propertyInfo.sourceNotes.push(`Notes: ${input.notes}`);
  }
  if (!caminoContext) {
    propertyInfo.sourceNotes.push(
      "No direct MLS/Rentcast adapter configured in this repository; using provided inputs."
    );
  }
  return propertyInfo;
}

async function runCommercialInvestmentWorkflow(input) {
  assertObject(input, "input");
  assertRequiredString(input.address, "input.address");

  const validatedAssumptions = validateInputs(input);
  const propertyInfo = await gatherPropertyInfo(input);
  const metricBundle = estimateMetrics(validatedAssumptions);
  const scenarios = buildScenarios(validatedAssumptions);
  const score = scoreOpportunity(metricBundle.values);
  const dataQuality = buildDataQuality(input, metricBundle.assumptions);
  const decision = buildDecision({
    metrics: metricBundle.values,
    score,
    dataQuality,
    targetCapRatePct: validatedAssumptions.targetCapRatePct,
  });
  const investmentSummary = buildSummary({
    address: input.address,
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
    scenarios,
    dataQuality,
    decision,
    investorOutreachDraft,
    report: {
      generatedAt: new Date().toISOString(),
      address: input.address,
      propertyInfo,
      assumptions: metricBundle.assumptions,
      investmentMetrics: metricBundle.values,
      opportunityScore: score,
      scenarios,
      dataQuality,
      decision,
      investmentSummary,
      investorOutreachDraft,
    },
  };
}

module.exports = {
  name: "commercial_investment_workflow",
  description:
    "Runs a commercial property underwriting workflow with validated inputs, scenario analysis, provenance, diligence, and a decision-ready report.",
  inputSchema: {
    type: "object",
    required: ["address", "purchasePrice", "annualGrossIncome"],
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
      targetCapRatePct: { type: "number" },
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
      scenarios: { type: "object" },
      dataQuality: { type: "object" },
      decision: { type: "object" },
      investorOutreachDraft: { type: "string" },
      report: { type: "object" },
    },
  },
  run: runCommercialInvestmentWorkflow,
};
