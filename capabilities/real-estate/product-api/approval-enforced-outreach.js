"use strict";

const crypto = require("crypto");

const OUTREACH_TASK_TYPE = "send_investor_outreach";

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

class ControlledOutreachTransport {
  constructor({ allowedRecipients = ["test-recipient@openrabbit.local"], deliveries = new Map() } = {}) {
    this.allowedRecipients = new Set(allowedRecipients.map((value) => value.toLowerCase()));
    this.deliveries = deliveries;
  }

  async send(message, { idempotencyKey }) {
    const recipient = required(message.recipient, "recipient").toLowerCase();
    if (!this.allowedRecipients.has(recipient)) {
      throw new Error(`Recipient is not allowed by the controlled transport: ${recipient}`);
    }
    if (this.deliveries.has(idempotencyKey)) return this.deliveries.get(idempotencyKey);
    const delivery = {
      id: `controlled-${crypto.randomUUID()}`,
      recipient,
      subject: required(message.subject, "subject"),
      body: required(message.body, "body"),
      mode: "controlled_test",
      deliveredAt: new Date().toISOString(),
    };
    this.deliveries.set(idempotencyKey, delivery);
    return delivery;
  }
}

class ApprovalEnforcedOutreachService {
  constructor({ repository, durableService, transport }) {
    if (!repository || !durableService || !transport) {
      throw new Error("repository, durableService, and transport are required");
    }
    this.repository = repository;
    this.durableService = durableService;
    this.transport = transport;
  }

  async request({ orgId, dealId, taskId, approvalId, workerId, requestedBy, message }) {
    const deal = await this.repository.getDeal(orgId, dealId);
    if (!deal) throw new Error(`Deal not found: ${dealId}`);
    return this.durableService.requestApproval({
      id: required(approvalId, "approvalId"),
      orgId: required(orgId, "orgId"),
      workerId: required(workerId, "workerId"),
      taskId: required(taskId, "taskId"),
      taskType: OUTREACH_TASK_TYPE,
      input: {
        dealId,
        requestedBy: required(requestedBy, "requestedBy"),
        message: {
          recipient: required(message?.recipient, "message.recipient").toLowerCase(),
          subject: required(message?.subject, "message.subject"),
          body: required(message?.body, "message.body"),
        },
      },
      policyId: "human-approval-required",
      metadata: { actionKind: "write", transport: "controlled_test" },
    });
  }

  decide(input) {
    return this.durableService.decideApproval(input);
  }

  async execute({ orgId, approvalId }) {
    const approval = await this.repository.getApproval(orgId, approvalId);
    if (!approval) throw new Error(`Approval request not found: ${approvalId}`);
    if (approval.orgId !== orgId) throw new Error("Approval tenant mismatch");
    if (approval.taskType !== OUTREACH_TASK_TYPE) throw new Error("Approval is not for investor outreach");
    if (approval.status !== "approved") throw new Error(`Approval is ${approval.status}; execution requires approved`);

    const existing = await this.repository.getTaskResult(orgId, approval.taskId);
    if (existing) return { ...existing.result, duplicate: true };

    const delivery = await this.transport.send(approval.input.message, {
      idempotencyKey: `${orgId}:${approval.id}:${approval.taskId}`,
    });
    const result = {
      orgId,
      taskId: approval.taskId,
      approvalId: approval.id,
      status: "completed",
      delivery,
    };
    await this.repository.saveTaskResult({ orgId, taskId: approval.taskId, result });
    await this.repository.appendAudit({
      id: `audit-${crypto.randomUUID()}`,
      orgId,
      kind: "task_completed",
      actorId: approval.decidedBy,
      workerId: approval.workerId,
      taskId: approval.taskId,
      approvalId: approval.id,
      action: OUTREACH_TASK_TYPE,
      outcome: "completed",
      metadata: { deliveryId: delivery.id, mode: delivery.mode },
    });
    return result;
  }
}

module.exports = {
  OUTREACH_TASK_TYPE,
  ControlledOutreachTransport,
  ApprovalEnforcedOutreachService,
};
