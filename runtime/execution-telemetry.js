"use strict";

const EXECUTION_STATUSES = new Set(["started", "succeeded", "failed"]);

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function nonNegativeNumber(value, name) {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

function nonNegativeInteger(value, name) {
  const number = nonNegativeNumber(value, name);
  if (!Number.isInteger(number)) throw new Error(`${name} must be an integer`);
  return number;
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: nonNegativeInteger(usage.inputTokens, "usage.inputTokens"),
    outputTokens: nonNegativeInteger(usage.outputTokens, "usage.outputTokens"),
    toolCalls: nonNegativeInteger(usage.toolCalls, "usage.toolCalls"),
    imageGenerations: nonNegativeInteger(usage.imageGenerations, "usage.imageGenerations"),
    videoSeconds: nonNegativeNumber(usage.videoSeconds, "usage.videoSeconds"),
  };
}

function normalizeCosts(costs = {}) {
  const normalized = {
    modelUsd: nonNegativeNumber(costs.modelUsd, "costs.modelUsd"),
    externalApiUsd: nonNegativeNumber(costs.externalApiUsd, "costs.externalApiUsd"),
    computeUsd: nonNegativeNumber(costs.computeUsd, "costs.computeUsd"),
  };
  normalized.totalUsd = Number(
    (normalized.modelUsd + normalized.externalApiUsd + normalized.computeUsd).toFixed(8)
  );
  return normalized;
}

function normalizeExecutionRecord(input) {
  if (!input || typeof input !== "object") throw new Error("execution record is required");

  const status = input.status || "started";
  if (!EXECUTION_STATUSES.has(status)) {
    throw new Error("status must be started, succeeded, or failed");
  }

  const attempt = input.attempt === undefined ? 1 : input.attempt;
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("attempt must be an integer >= 1");

  const record = {
    executionId: requiredString(input.executionId, "executionId"),
    tenantId: requiredString(input.tenantId, "tenantId"),
    workflowId: requiredString(input.workflowId, "workflowId"),
    attempt,
    status,
    startedAt: input.startedAt || new Date().toISOString(),
    usage: normalizeUsage(input.usage),
    costs: normalizeCosts(input.costs),
    metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {},
  };

  if (input.agentId) record.agentId = requiredString(input.agentId, "agentId");
  if (input.provider) record.provider = requiredString(input.provider, "provider");
  if (input.model) record.model = requiredString(input.model, "model");
  if (input.completedAt) record.completedAt = input.completedAt;
  if (input.errorCode) record.errorCode = requiredString(input.errorCode, "errorCode");

  return record;
}

class InMemoryExecutionTelemetryStore {
  constructor() {
    this.records = new Map();
  }

  key(record) {
    return `${record.tenantId}:${record.executionId}:${record.attempt}`;
  }

  async append(input) {
    const record = normalizeExecutionRecord(input);
    const key = this.key(record);
    if (this.records.has(key)) throw new Error(`execution attempt already exists: ${record.executionId}#${record.attempt}`);
    this.records.set(key, record);
    return { ...record };
  }

  async listByExecution(tenantId, executionId) {
    requiredString(tenantId, "tenantId");
    requiredString(executionId, "executionId");
    return [...this.records.values()]
      .filter((record) => record.tenantId === tenantId && record.executionId === executionId)
      .sort((a, b) => a.attempt - b.attempt)
      .map((record) => ({ ...record }));
  }

  async summarizeWorkflow(tenantId, workflowId) {
    requiredString(tenantId, "tenantId");
    requiredString(workflowId, "workflowId");
    const records = [...this.records.values()].filter(
      (record) => record.tenantId === tenantId && record.workflowId === workflowId
    );

    const successfulExecutions = new Set(
      records.filter((record) => record.status === "succeeded").map((record) => record.executionId)
    );

    const totalVariableCostUsd = Number(
      records.reduce((sum, record) => sum + record.costs.totalUsd, 0).toFixed(8)
    );

    return {
      tenantId,
      workflowId,
      attempts: records.length,
      successfulJobs: successfulExecutions.size,
      failedAttempts: records.filter((record) => record.status === "failed").length,
      totalVariableCostUsd,
      costPerSuccessfulJobUsd: successfulExecutions.size
        ? Number((totalVariableCostUsd / successfulExecutions.size).toFixed(8))
        : null,
    };
  }
}

module.exports = {
  EXECUTION_STATUSES,
  normalizeExecutionRecord,
  normalizeUsage,
  normalizeCosts,
  InMemoryExecutionTelemetryStore,
};
