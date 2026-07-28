const assert = require("assert");
const {
  createOpenClawSkillRunner,
  getSkillCatalog,
} = require("../src/skills");

async function runTests() {
  const catalog = getSkillCatalog();
  assert.strictEqual(Array.isArray(catalog), true);
  assert.strictEqual(catalog.length >= 3, true);

  const runner = createOpenClawSkillRunner({ actor: "openclaw" });

  const complianceApproved = await runner.run("post_compliance_guard", {
    postId: "post-1",
    content: "Join us this Sunday. Equal Housing Opportunity.",
  });
  assert.strictEqual(complianceApproved.approved, true);

  const complianceRejected = await runner.run("post_compliance_guard", {
    postId: "post-2",
    content: "Join us this Sunday.",
  });
  assert.strictEqual(complianceRejected.approved, false);

  const publishResult = await runner.run("social_post_publish", {
    postId: "post-3",
    platform: "facebook",
    content: "New listing available. Equal Housing Opportunity.",
    mode: "dry_run",
    mediaUrls: [],
  });
  assert.strictEqual(publishResult.ok, true);
  assert.strictEqual(publishResult.published, false);

  const browserResult = await runner.run("browser_session", {
    sessionId: "session-1",
    action: "navigate",
    mode: "dry_run",
    target: {
      platform: "facebook",
      url: "https://business.facebook.com",
    },
  });
  assert.strictEqual(browserResult.ok, true);
  assert.strictEqual(browserResult.performed, false);

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

  let threwUnknownSkill = false;
  try {
    await runner.run("unknown_skill", {});
  } catch (_error) {
    threwUnknownSkill = true;
  }
  assert.strictEqual(threwUnknownSkill, true);

  console.log("All skill scaffold tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
