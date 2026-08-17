"use strict";

const crypto = require("crypto");
const workflow = require("../workflows/commercial-investment-workflow");
const { CONTRACT_VERSION } = require("../contracts/underwriting-contract");

const UNDERWRITING_WORKFLOW_ID = "commercial-underwriting";

class DurableUnderwritingService {
  constructor({ repository, telemetryStore, executeUnderwriting = (input) => workflow.run(input) }) {
    if (!repository) throw new Error("repository is required");
    this.repository = repository;
    this.telemetryStore = telemetryStore;
    this.executeUnderwriting = executeUnderwriting;
  }

  createDeal(input) {
    return this.repository.createDeal(input);
  }

  getDeal(orgId, dealId) {
    return this.repository.getDeal(orgId, dealId);
  }

  listRuns(orgId, dealId) {
    return this.repository.listUnderwritingRuns(orgId, dealId);
  }

  async recordUnderwritingTelemetry({ orgId, dealId, taskId, status, telemetry = {}, error }) {
    if (!this.telemetryStore) return;
    await this.telemetryStore.append({
      executionId: taskId,
      tenantId: orgId,
      workflowId: UNDERWRITING_WORKFLOW_ID,
      attempt: telemetry.attempt || 1,
      status,
      agentId: telemetry.agentId,
      provider: telemetry.provider,
      model: telemetry.model,
      usage: telemetry.usage,
      costs: telemetry.costs,
      completedAt: new Date().toISOString(),
      errorCode: error && (error.code || error.name || "UNDERWRITING_FAILED"),
      metadata: {
        ...telemetry.metadata,
        dealId,
      },
    });
  }

  async runUnderwriting({ orgId, dealId, taskId, input, telemetry = {} }) {
    const existing = await this.repository.getTaskResult(orgId, taskId);
    if (existing) return { ...existing.result, duplicate: true };

    const deal = await this.repository.getDeal(orgId, dealId);
    if (!deal) throw new Error(`Deal not found: ${dealId}`);

    const workflowInput = { ...input, address: input.address || deal.address, propertyType: input.propertyType || deal.propertyType };
    let rawOutput;
    try {
      rawOutput = await this.executeUnderwriting(workflowInput);
    } catch (error) {
      await this.recordUnderwritingTelemetry({
        orgId,
        dealId,
        taskId,
        status: "failed",
        telemetry,
        error,
      });
      throw error;
    }

    const output = {
      ...rawOutput,
      contractVersion: CONTRACT_VERSION,
      report: {
        ...rawOutput.report,
        contractVersion: CONTRACT_VERSION,
      },
    };
    const result = { orgId, dealId, taskId, status: "completed", output };

    await this.repository.saveUnderwritingRun({
      orgId,
      dealId,
      taskId,
      input: workflowInput,
      report: output.report,
      status: "completed",
    });
    await this.repository.saveTaskResult({ orgId, taskId, result });
    await this.repository.appendAudit({
      id: `audit-${crypto.randomUUID()}`,
      orgId,
      kind: "task_completed",
      taskId,
      action: "commercial_investment_workflow",
      outcome: "completed",
      metadata: { dealId },
    });
    await this.recordUnderwritingTelemetry({
      orgId,
      dealId,
      taskId,
      status: "succeeded",
      telemetry,
    });
    return result;
  }

  async requestApproval(input) {
    const approval = await this.repository.createApproval(input);
    await this.repository.appendAudit({
      id: `audit-${crypto.randomUUID()}`,
      orgId: input.orgId,
      kind: "approval_requested",
      workerId: input.workerId,
      taskId: input.taskId,
      approvalId: input.id,
      action: input.taskType,
      outcome: "pending",
      metadata: { policyId: input.policyId },
    });
    return approval;
  }

  async decideApproval(input) {
    const approval = await this.repository.decideApproval(
      input.orgId,
      input.approvalId,
      input.decision,
      input.decidedBy
    );
    await this.repository.appendAudit({
      id: `audit-${crypto.randomUUID()}`,
      orgId: input.orgId,
      kind: input.decision === "approve" ? "approval_approved" : "approval_denied",
      actorId: input.decidedBy,
      taskId: approval.taskId,
      approvalId: approval.id,
      action: approval.taskType,
      outcome: approval.status,
    });
    return approval;
  }
}

module.exports = { DurableUnderwritingService, UNDERWRITING_WORKFLOW_ID };
