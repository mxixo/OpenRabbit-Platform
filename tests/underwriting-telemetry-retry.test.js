"use strict";

const assert = require("assert");
const workflow = require("../capabilities/real-estate/workflows/commercial-investment-workflow");
const {
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const {
  DurableUnderwritingService,
} = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const {
  InMemoryExecutionTelemetryStore,
} = require("../runtime/execution-telemetry");

async function runTests() {
  const repository = new InMemoryRealEstateStateRepository();
  const telemetryStore = new InMemoryExecutionTelemetryStore();
  let calls = 0;
  const upstreamError = Object.assign(new Error("temporary provider failure"), {
    code: "UPSTREAM_UNAVAILABLE",
  });

  const service = new DurableUnderwritingService({
    repository,
    telemetryStore,
    executeUnderwriting: async (input) => {
      calls += 1;
      if (calls === 1) throw upstreamError;
      return workflow.run(input);
    },
  });

  await service.createDeal({
    id: "deal-retry",
    orgId: "org-retry",
    address: "1 Retry Ave, Phoenix, AZ",
    propertyType: "commercial",
  });

  await assert.rejects(
    () => service.runUnderwriting({
      orgId: "org-retry",
      dealId: "deal-retry",
      taskId: "underwrite-retry-1",
      input: { purchasePrice: 1000000, annualGrossIncome: 180000 },
      telemetry: {
        provider: "openai",
        model: "example-model",
        costs: { modelUsd: 0.004 },
      },
    }),
    /temporary provider failure/
  );

  const completed = await service.runUnderwriting({
    orgId: "org-retry",
    dealId: "deal-retry",
    taskId: "underwrite-retry-1",
    input: { purchasePrice: 1000000, annualGrossIncome: 180000 },
    telemetry: {
      provider: "openai",
      model: "example-model",
      costs: { modelUsd: 0.006 },
    },
  });
  assert.strictEqual(completed.status, "completed");

  const attempts = await telemetryStore.listByExecution("org-retry", "underwrite-retry-1");
  assert.deepStrictEqual(attempts.map((record) => record.attempt), [1, 2]);
  assert.deepStrictEqual(attempts.map((record) => record.status), ["failed", "succeeded"]);
  assert.strictEqual(attempts[0].errorCode, "UPSTREAM_UNAVAILABLE");
  assert.strictEqual(attempts[0].costs.totalUsd, 0.004);
  assert.strictEqual(attempts[1].costs.totalUsd, 0.006);

  const summary = await telemetryStore.summarizeWorkflow("org-retry", "commercial-underwriting");
  assert.strictEqual(summary.attempts, 2);
  assert.strictEqual(summary.failedAttempts, 1);
  assert.strictEqual(summary.successfulJobs, 1);
  assert.strictEqual(summary.totalVariableCostUsd, 0.01);
  assert.strictEqual(summary.costPerSuccessfulJobUsd, 0.01);

  const duplicate = await service.runUnderwriting({
    orgId: "org-retry",
    dealId: "deal-retry",
    taskId: "underwrite-retry-1",
    input: { purchasePrice: 999 },
  });
  assert.strictEqual(duplicate.duplicate, true);
  assert.strictEqual((await telemetryStore.listByExecution("org-retry", "underwrite-retry-1")).length, 2);

  console.log("Underwriting telemetry retry tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
