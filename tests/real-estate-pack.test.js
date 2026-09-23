const assert = require("assert");
const capability = require("../capabilities/real-estate");
const realEstatePack = require("../packs/real-estate");
const legacySkill = require("../src/skills/commercial-investment-workflow.skill");

function environmentBlueprint(overrides = {}) {
  return {
    protocol: "environment_blueprint_v1",
    orgId: "org-phoenix",
    revision: "rev-001",
    generatedAt: "2026-09-23T05:00:00.000Z",
    packs: [{ id: "pack.real-estate", version: "0.1.0", state: "enabled" }],
    capabilities: [],
    integrations: [],
    workers: [],
    workflows: [],
    surfaces: [],
    ...overrides,
  };
}

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

  let requestedUrl;
  let requestedOptions;
  const blueprint = environmentBlueprint();
  const loaded = await realEstatePack.environment.loadRealEstateEnvironment({
    baseUrl: "https://platform.openrabbit.example/",
    orgId: "org-phoenix",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 200, result: blueprint } }),
      };
    },
  });

  assert.strictEqual(
    requestedUrl,
    "https://platform.openrabbit.example/v1/orgs/org-phoenix/environment"
  );
  assert.deepStrictEqual(requestedOptions, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  assert.strictEqual(loaded, blueprint);

  await assert.rejects(
    () =>
      realEstatePack.environment.loadRealEstateEnvironment({
        baseUrl: "https://platform.openrabbit.example",
        orgId: "org-phoenix",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => environmentBlueprint({ orgId: "org-other" }),
        }),
      }),
    /different organization/
  );

  assert.throws(
    () =>
      realEstatePack.environment.validateRealEstateEnvironment(
        environmentBlueprint({
          packs: [{ id: "pack.real-estate", version: "0.1.0", state: "disabled" }],
        }),
        "org-phoenix"
      ),
    /real estate pack is not enabled/
  );

  console.log("Real Estate capability and pack tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
