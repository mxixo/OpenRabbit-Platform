"use strict";

const crypto = require("crypto");
const workflow = require("../workflows/commercial-investment-workflow");

class DurableUnderwritingService {
  constructor({ repository, executeUnderwriting = (input) => workflow.run(input) }) {
    if (!repository) throw new Error("repository is required");
    this.repository = repository;
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

  async runUnderwriting({ orgId, dealId, taskId, input }) {
    const existing = await this.repository.getTaskResult(orgId, taskId);
    if (existing) return { ...existing.result, duplicate: true };

    const deal = await this.repository.getDeal(orgId, dealId);
    if (!deal) throw new Error(`Deal not found: ${dealId}`);

    const workflowInput = { ...input, address: input.address || deal.address, propertyType: input.propertyType || deal.propertyType };
    const output = await this.executeUnderwriting(workflowInput);
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

module.exports = { DurableUnderwritingService };
