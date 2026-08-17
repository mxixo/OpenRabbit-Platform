"use strict";

const assert = require("assert");
const {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const {
  DurableUnderwritingService,
} = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const {
  InMemoryExecutionTelemetryStore,
} = require("../runtime/execution-telemetry");

async function runTests() {
  const backing = createInMemoryStateBacking();
  const telemetryStore = new InMemoryExecutionTelemetryStore();
  const repositoryBeforeRestart = new InMemoryRealEstateStateRepository(backing);
  const serviceBeforeRestart = new DurableUnderwritingService({
    repository: repositoryBeforeRestart,
    telemetryStore,
  });

  await serviceBeforeRestart.createDeal({
    id: "deal-royal-inn",
    orgId: "org-maico",
    address: "2510 W Palo Verde Dr, Phoenix, AZ",
    propertyType: "multifamily",
  });

  const first = await serviceBeforeRestart.runUnderwriting({
    orgId: "org-maico",
    dealId: "deal-royal-inn",
    taskId: "underwrite-1",
    input: { purchasePrice: 1600000, annualGrossIncome: 260000 },
    telemetry: {
      provider: "openai",
      model: "example-model",
      usage: { inputTokens: 120, outputTokens: 30, toolCalls: 1 },
      costs: { modelUsd: 0.012, externalApiUsd: 0.003 },
    },
  });
  assert.strictEqual(first.status, "completed");

  const firstTelemetry = await telemetryStore.listByExecution("org-maico", "underwrite-1");
  assert.strictEqual(firstTelemetry.length, 1);
  assert.strictEqual(firstTelemetry[0].status, "succeeded");
  assert.strictEqual(firstTelemetry[0].workflowId, "commercial-underwriting");
  assert.strictEqual(firstTelemetry[0].metadata.dealId, "deal-royal-inn");
  assert.strictEqual(firstTelemetry[0].costs.totalUsd, 0.015);

  const repositoryAfterRestart = new InMemoryRealEstateStateRepository(backing);
  const serviceAfterRestart = new DurableUnderwritingService({
    repository: repositoryAfterRestart,
    telemetryStore,
  });
  assert.strictEqual((await serviceAfterRestart.getDeal("org-maico", "deal-royal-inn")).address, "2510 W Palo Verde Dr, Phoenix, AZ");
  assert.strictEqual((await serviceAfterRestart.listRuns("org-maico", "deal-royal-inn")).length, 1);

  const duplicate = await serviceAfterRestart.runUnderwriting({
    orgId: "org-maico",
    dealId: "deal-royal-inn",
    taskId: "underwrite-1",
    input: { purchasePrice: 999, annualGrossIncome: 999 },
  });
  assert.strictEqual(duplicate.duplicate, true);
  assert.strictEqual((await serviceAfterRestart.listRuns("org-maico", "deal-royal-inn")).length, 1);
  assert.strictEqual((await telemetryStore.listByExecution("org-maico", "underwrite-1")).length, 1);

  await serviceAfterRestart.runUnderwriting({
    orgId: "org-maico",
    dealId: "deal-royal-inn",
    taskId: "underwrite-2",
    input: { purchasePrice: 1500000, annualGrossIncome: 260000 },
  });
  const versions = await serviceAfterRestart.listRuns("org-maico", "deal-royal-inn");
  assert.deepStrictEqual(versions.map((run) => run.version), [1, 2]);
  assert.strictEqual(versions[0].report.assumptions.purchasePrice, 1600000);
  assert.strictEqual(versions[1].report.assumptions.purchasePrice, 1500000);

  const summary = await telemetryStore.summarizeWorkflow("org-maico", "commercial-underwriting");
  assert.strictEqual(summary.attempts, 2);
  assert.strictEqual(summary.successfulJobs, 2);
  assert.strictEqual(summary.totalVariableCostUsd, 0.015);
  assert.strictEqual(summary.costPerSuccessfulJobUsd, 0.0075);

  assert.strictEqual(await serviceAfterRestart.getDeal("other-org", "deal-royal-inn"), undefined);
  assert.deepStrictEqual(await serviceAfterRestart.listRuns("other-org", "deal-royal-inn"), []);

  const approval = await serviceAfterRestart.requestApproval({
    id: "approval-1",
    orgId: "org-maico",
    workerId: "worker-acquisitions",
    taskId: "outreach-1",
    taskType: "send_investor_outreach",
    input: { dealId: "deal-royal-inn" },
    policyId: "human-approval",
  });
  assert.strictEqual(approval.status, "pending");
  const decided = await serviceAfterRestart.decideApproval({
    orgId: "org-maico",
    approvalId: "approval-1",
    decision: "approve",
    decidedBy: "maico",
  });
  assert.strictEqual(decided.status, "approved");
  assert.strictEqual(decided.decidedBy, "maico");
  assert.strictEqual((await repositoryAfterRestart.listAudit("org-maico")).length, 4);
  assert.deepStrictEqual(await repositoryAfterRestart.listAudit("other-org"), []);

  const failedRepository = new InMemoryRealEstateStateRepository();
  const failedTelemetryStore = new InMemoryExecutionTelemetryStore();
  const upstreamError = Object.assign(new Error("provider unavailable"), { code: "UPSTREAM_UNAVAILABLE" });
  const failedService = new DurableUnderwritingService({
    repository: failedRepository,
    telemetryStore: failedTelemetryStore,
    executeUnderwriting: async () => { throw upstreamError; },
  });
  await failedService.createDeal({
    id: "deal-failure",
    orgId: "org-maico",
    address: "1 Test Ave, Phoenix, AZ",
  });
  await assert.rejects(
    () => failedService.runUnderwriting({
      orgId: "org-maico",
      dealId: "deal-failure",
      taskId: "underwrite-failed-1",
      input: { purchasePrice: 100000 },
      telemetry: { attempt: 1, provider: "openai", model: "example-model", costs: { modelUsd: 0.004 } },
    }),
    /provider unavailable/
  );
  const failedTelemetry = await failedTelemetryStore.listByExecution("org-maico", "underwrite-failed-1");
  assert.strictEqual(failedTelemetry.length, 1);
  assert.strictEqual(failedTelemetry[0].status, "failed");
  assert.strictEqual(failedTelemetry[0].errorCode, "UPSTREAM_UNAVAILABLE");
  assert.strictEqual(failedTelemetry[0].costs.totalUsd, 0.004);

  console.log("Durable underwriting state tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
