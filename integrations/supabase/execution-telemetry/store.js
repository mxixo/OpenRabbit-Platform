"use strict";

const { normalizeExecutionRecord } = require("../../../runtime/execution-telemetry");

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function mapRow(row) {
  return {
    executionId: row.execution_id,
    tenantId: row.tenant_id,
    workflowId: row.workflow_id,
    attempt: row.attempt,
    status: row.status,
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    ...(row.provider ? { provider: row.provider } : {}),
    ...(row.model ? { model: row.model } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    usage: {
      inputTokens: Number(row.input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
      toolCalls: Number(row.tool_calls || 0),
      imageGenerations: Number(row.image_generations || 0),
      videoSeconds: Number(row.video_seconds || 0),
    },
    costs: {
      modelUsd: Number(row.model_usd || 0),
      externalApiUsd: Number(row.external_api_usd || 0),
      computeUsd: Number(row.compute_usd || 0),
      totalUsd: Number(row.total_usd || 0),
    },
    metadata: row.metadata || {},
  };
}

class SupabaseExecutionTelemetryStore {
  constructor({ projectUrl, secretKey, fetchImpl = fetch }) {
    this.baseUrl = `${requiredString(projectUrl, "projectUrl").replace(/\/$/, "")}/rest/v1`;
    this.secretKey = requiredString(secretKey, "secretKey");
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/${path}`, {
      ...options,
      headers: {
        apikey: this.secretKey,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase telemetry request failed (${response.status}): ${await response.text()}`);
    }
    if (response.status === 204) return [];
    return response.json();
  }

  async append(input) {
    const record = normalizeExecutionRecord(input);
    const rows = await this.request("execution_telemetry", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: record.tenantId,
        execution_id: record.executionId,
        attempt: record.attempt,
        workflow_id: record.workflowId,
        status: record.status,
        agent_id: record.agentId,
        provider: record.provider,
        model: record.model,
        started_at: record.startedAt,
        completed_at: record.completedAt,
        input_tokens: record.usage.inputTokens,
        output_tokens: record.usage.outputTokens,
        tool_calls: record.usage.toolCalls,
        image_generations: record.usage.imageGenerations,
        video_seconds: record.usage.videoSeconds,
        model_usd: record.costs.modelUsd,
        external_api_usd: record.costs.externalApiUsd,
        compute_usd: record.costs.computeUsd,
        error_code: record.errorCode,
        metadata: record.metadata,
      }),
    });
    return mapRow(rows[0]);
  }

  async listByExecution(tenantId, executionId) {
    requiredString(tenantId, "tenantId");
    requiredString(executionId, "executionId");
    const rows = await this.request(
      `execution_telemetry?tenant_id=eq.${encodeURIComponent(tenantId)}&execution_id=eq.${encodeURIComponent(executionId)}&order=attempt.asc`,
      { method: "GET" }
    );
    return rows.map(mapRow);
  }

  async summarizeWorkflow(tenantId, workflowId) {
    requiredString(tenantId, "tenantId");
    requiredString(workflowId, "workflowId");
    const rows = await this.request(
      `execution_telemetry?tenant_id=eq.${encodeURIComponent(tenantId)}&workflow_id=eq.${encodeURIComponent(workflowId)}&select=execution_id,status,total_usd`,
      { method: "GET" }
    );
    const successfulExecutions = new Set(
      rows.filter((row) => row.status === "succeeded").map((row) => row.execution_id)
    );
    const totalVariableCostUsd = Number(
      rows.reduce((sum, row) => sum + Number(row.total_usd || 0), 0).toFixed(8)
    );
    return {
      tenantId,
      workflowId,
      attempts: rows.length,
      successfulJobs: successfulExecutions.size,
      failedAttempts: rows.filter((row) => row.status === "failed").length,
      totalVariableCostUsd,
      costPerSuccessfulJobUsd: successfulExecutions.size
        ? Number((totalVariableCostUsd / successfulExecutions.size).toFixed(8))
        : null,
    };
  }
}

module.exports = { SupabaseExecutionTelemetryStore, mapRow };
