"use strict";

const assert = require("assert");
const {
  normalizeExecutionRecord,
  InMemoryExecutionTelemetryStore,
} = require("../runtime/execution-telemetry");

async function run() {
  const normalized = normalizeExecutionRecord({
    executionId: "exec-1",
    tenantId: "org-1",
    workflowId: "commercial-underwriting",
    agentId: "underwriter",
    provider: "openai",
    model: "example-model",
    status: "succeeded",
    usage: { inputTokens: 100, outputTokens: 25, toolCalls: 2 },
    costs: { modelUsd: 0.01, externalApiUsd: 0.02, computeUsd: 0.005 },
  });

  assert.equal(normalized.attempt, 1);
  assert.equal(normalized.usage.inputTokens, 100);
  assert.equal(normalized.usage.imageGenerations, 0);
  assert.equal(normalized.costs.totalUsd, 0.035);
  assert.equal(normalized.provider, "openai");

  assert.throws(
    () => normalizeExecutionRecord({ executionId: "x", tenantId: "org-1" }),
    /workflowId is required/
  );
  assert.throws(
    () => normalizeExecutionRecord({ executionId: "x", tenantId: "org-1", workflowId: "w", attempt: 0 }),
    /attempt must be an integer >= 1/
  );
  assert.throws(
    () => normalizeExecutionRecord({ executionId: "x", tenantId: "org-1", workflowId: "w", costs: { modelUsd: -1 } }),
    /non-negative number/
  );

  const store = new InMemoryExecutionTelemetryStore();
  await store.append({
    executionId: "job-1",
    tenantId: "org-1",
    workflowId: "commercial-underwriting",
    attempt: 1,
    status: "failed",
    provider: "openai",
    model: "routine-model",
    usage: { inputTokens: 200, outputTokens: 50, toolCalls: 1 },
    costs: { modelUsd: 0.01 },
    errorCode: "UPSTREAM_TIMEOUT",
  });
  await store.append({
    executionId: "job-1",
    tenantId: "org-1",
    workflowId: "commercial-underwriting",
    attempt: 2,
    status: "succeeded",
    provider: "openai",
    model: "reasoning-model",
    usage: { inputTokens: 300, outputTokens: 80, toolCalls: 2 },
    costs: { modelUsd: 0.03, externalApiUsd: 0.01 },
  });

  const attempts = await store.listByExecution("org-1", "job-1");
  assert.deepEqual(attempts.map((record) => record.attempt), [1, 2]);
  assert.deepEqual(attempts.map((record) => record.status), ["failed", "succeeded"]);

  const summary = await store.summarizeWorkflow("org-1", "commercial-underwriting");
  assert.equal(summary.attempts, 2);
  assert.equal(summary.successfulJobs, 1);
  assert.equal(summary.failedAttempts, 1);
  assert.equal(summary.totalVariableCostUsd, 0.05);
  assert.equal(summary.costPerSuccessfulJobUsd, 0.05);

  await assert.rejects(
    () => store.append({ executionId: "job-1", tenantId: "org-1", workflowId: "commercial-underwriting", attempt: 2 }),
    /execution attempt already exists/
  );

  console.log("execution telemetry tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
