"use strict";

const assert = require("assert");
const { InMemoryRealEstateStateRepository } = require("../capabilities/real-estate/persistence/state-repository");
const { DurableUnderwritingService } = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const { InMemoryExecutionTelemetryStore } = require("../runtime/execution-telemetry");

async function runTests() {
  const repository = new InMemoryRealEstateStateRepository();
  const telemetryStore = new InMemoryExecutionTelemetryStore();
  const service = new DurableUnderwritingService({ repository, telemetryStore });

  await service.createDeal({ id: "deal-actor", orgId: "org-1", address: "1 Audit Way, Phoenix, AZ" });
  await service.runUnderwriting({
    orgId: "org-1",
    dealId: "deal-actor",
    taskId: "task-actor",
    actorId: "operator-1",
    input: { purchasePrice: 500000, annualGrossIncome: 90000 },
  });

  const audit = await repository.listAudit("org-1");
  const completed = audit.find((record) => record.kind === "task_completed" && record.taskId === "task-actor");
  assert.ok(completed);
  assert.strictEqual(completed.actorId, "operator-1");

  const telemetry = await telemetryStore.listByExecution("org-1", "task-actor");
  assert.strictEqual(telemetry.length, 1);
  assert.strictEqual(telemetry[0].metadata.actorId, "operator-1");

  await service.requestApproval({
    id: "approval-actor",
    orgId: "org-1",
    workerId: "worker-1",
    taskId: "outreach-actor",
    taskType: "send_investor_outreach",
    input: { dealId: "deal-actor" },
    policyId: "human-approval",
    requestedBy: "operator-1",
  });
  const approvalAudit = (await repository.listAudit("org-1")).find((record) => record.kind === "approval_requested");
  assert.strictEqual(approvalAudit.actorId, "operator-1");

  console.log("Actor attribution tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
