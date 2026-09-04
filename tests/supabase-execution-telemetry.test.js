"use strict";

const assert = require("assert");
const { SupabaseExecutionTelemetryStore } = require("../integrations/supabase/execution-telemetry/store");

function createFetchStub() {
  const rows = [];
  return {
    rows,
    fetch: async (url, options = {}) => {
      const parsed = new URL(url);
      const table = parsed.pathname.split("/").pop();
      assert.strictEqual(table, "execution_telemetry");
      assert.strictEqual(options.headers.apikey, "secret-test-key");

      if (options.method === "POST") {
        const body = JSON.parse(options.body);
        if (rows.some((row) => row.tenant_id === body.tenant_id && row.execution_id === body.execution_id && row.attempt === body.attempt)) {
          return new Response(JSON.stringify({ message: "duplicate" }), { status: 409 });
        }
        const row = {
          ...body,
          total_usd: Number(body.model_usd || 0) + Number(body.external_api_usd || 0) + Number(body.compute_usd || 0),
          created_at: "2026-08-17T08:30:00.000Z",
        };
        rows.push(row);
        return Response.json([row]);
      }

      let selected = rows.slice();
      const tenantId = parsed.searchParams.get("tenant_id")?.replace(/^eq\./, "");
      const executionId = parsed.searchParams.get("execution_id")?.replace(/^eq\./, "");
      const workflowId = parsed.searchParams.get("workflow_id")?.replace(/^eq\./, "");
      if (tenantId) selected = selected.filter((row) => row.tenant_id === tenantId);
      if (executionId) selected = selected.filter((row) => row.execution_id === executionId);
      if (workflowId) selected = selected.filter((row) => row.workflow_id === workflowId);
      if (parsed.searchParams.get("order") === "attempt.asc") selected.sort((a, b) => a.attempt - b.attempt);
      return Response.json(selected);
    },
  };
}

async function runTests() {
  const stub = createFetchStub();
  const store = new SupabaseExecutionTelemetryStore({
    projectUrl: "https://example.supabase.co/",
    secretKey: "secret-test-key",
    fetchImpl: stub.fetch,
  });

  await store.append({
    tenantId: "org-1",
    executionId: "job-1",
    workflowId: "commercial-underwriting",
    attempt: 1,
    status: "failed",
    provider: "openai",
    model: "model-a",
    usage: { inputTokens: 100, outputTokens: 20, toolCalls: 1 },
    costs: { modelUsd: 0.01, externalApiUsd: 0.002 },
    errorCode: "UPSTREAM_UNAVAILABLE",
    completedAt: "2026-08-17T08:29:30.000Z",
  });
  await store.append({
    tenantId: "org-1",
    executionId: "job-1",
    workflowId: "commercial-underwriting",
    attempt: 2,
    status: "succeeded",
    provider: "openai",
    model: "model-b",
    costs: { modelUsd: 0.008 },
    completedAt: "2026-08-17T08:29:45.000Z",
  });

  const attempts = await store.listByExecution("org-1", "job-1");
  assert.deepStrictEqual(attempts.map((item) => item.attempt), [1, 2]);
  assert.strictEqual(attempts[0].costs.totalUsd, 0.012);
  assert.strictEqual(attempts[1].status, "succeeded");

  const summary = await store.summarizeWorkflow("org-1", "commercial-underwriting");
  assert.strictEqual(summary.attempts, 2);
  assert.strictEqual(summary.failedAttempts, 1);
  assert.strictEqual(summary.successfulJobs, 1);
  assert.strictEqual(summary.totalVariableCostUsd, 0.02);
  assert.strictEqual(summary.costPerSuccessfulJobUsd, 0.02);

  await assert.rejects(
    () => store.append({ tenantId: "org-1", executionId: "job-1", workflowId: "commercial-underwriting", attempt: 2 }),
    /Supabase telemetry request failed \(409\)/
  );

  console.log("Supabase execution telemetry tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
