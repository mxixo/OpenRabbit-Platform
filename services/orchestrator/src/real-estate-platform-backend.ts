import {
  InMemoryApprovalRequestStore,
  InMemoryAuditStore,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type AuditRecord,
  type AuditRecordKind,
  type WorkerTaskActionKind,
  type WorkerTaskApproval,
  type WorkerTaskResult
} from "@openrabbit/runtime-core";
import { bootstrapRealEstateOrg, RealEstateBootstrap } from "./bootstrap-real-estate.js";

export interface RealEstatePlatformWorkerSummary {
  id: string;
  role: string;
  displayName: string;
  status?: string;
}

export interface ApprovalDecisionResult {
  approval: ApprovalRequest;
  taskResult?: WorkerTaskResult;
}

export interface RealEstatePlatformBackendContract {
  installRealEstatePack(orgId: string): Promise<{ packId: string; workerIds: string[] }>;
  listWorkers(orgId: string): Promise<RealEstatePlatformWorkerSummary[]>;
  submitWorkerTask(input: {
    orgId: string;
    workerId: string;
    taskId: string;
    taskType: string;
    input: unknown;
    actionKind?: WorkerTaskActionKind;
    approval?: WorkerTaskApproval;
  }): Promise<WorkerTaskResult>;
  getTaskResult(orgId: string, taskId: string): Promise<WorkerTaskResult | undefined>;
  listApprovals(orgId: string, status?: ApprovalRequestStatus): Promise<ApprovalRequest[]>;
  listAudit(orgId: string): Promise<AuditRecord[]>;
  decideApproval(input: {
    orgId: string;
    approvalId: string;
    decision: "approve" | "deny";
    decidedBy: string;
  }): Promise<ApprovalDecisionResult>;
}

/**
 * Concrete backend for the first Platform API routes.
 *
 * It deliberately lives with orchestration/composition instead of the API
 * gateway. The API gateway depends only on a structural backend contract.
 */
export class RealEstatePlatformBackend implements RealEstatePlatformBackendContract {
  private readonly orgs = new Map<string, RealEstateBootstrap>();
  private readonly taskResults = new Map<string, WorkerTaskResult>();
  private readonly approvals = new InMemoryApprovalRequestStore();
  private readonly audit = new InMemoryAuditStore();
  private readonly approvalIdByTask = new Map<string, string>();
  private auditSequence = 0;

  async installRealEstatePack(
    orgId: string
  ): Promise<{ packId: string; workerIds: string[] }> {
    const normalizedOrgId = orgId.trim();
    if (!normalizedOrgId) {
      throw new Error("orgId is required");
    }

    let bootstrap = this.orgs.get(normalizedOrgId);
    if (!bootstrap) {
      bootstrap = await bootstrapRealEstateOrg(normalizedOrgId);
      this.orgs.set(normalizedOrgId, bootstrap);
    }

    return {
      packId: "pack.real-estate",
      workerIds: [
        bootstrap.acquisitionsWorker.id,
        ...(bootstrap.researchWorker ? [bootstrap.researchWorker.id] : [])
      ]
    };
  }

  async listWorkers(orgId: string): Promise<RealEstatePlatformWorkerSummary[]> {
    const bootstrap = this.orgs.get(orgId);
    if (!bootstrap) {
      return [];
    }

    return [bootstrap.acquisitionsWorker, bootstrap.researchWorker]
      .filter((worker): worker is NonNullable<typeof worker> => Boolean(worker))
      .map((worker) => ({
        id: worker.id,
        role: worker.role,
        displayName: worker.displayName,
        status: worker.status ?? "active"
      }));
  }

  async submitWorkerTask(input: {
    orgId: string;
    workerId: string;
    taskId: string;
    taskType: string;
    input: unknown;
    actionKind?: WorkerTaskActionKind;
    approval?: WorkerTaskApproval;
  }): Promise<WorkerTaskResult> {
    this.recordAudit(input.orgId, "task_requested", {
      workerId: input.workerId,
      taskId: input.taskId,
      action: input.taskType,
      metadata: { actionKind: input.actionKind ?? "read" }
    });

    const bootstrap = this.orgs.get(input.orgId);
    if (!bootstrap) {
      const rejected: WorkerTaskResult = {
        workerId: input.workerId,
        taskId: input.taskId,
        status: "rejected",
        error: {
          code: "pack_not_installed",
          message: `Real Estate Pack is not installed for org ${input.orgId}`
        },
        completedAt: new Date().toISOString()
      };
      this.recordTaskOutcome(input.orgId, input.taskType, rejected);
      return rejected;
    }

    const result = await bootstrap.service.runWorkerTask({
      workerId: input.workerId,
      taskId: input.taskId,
      taskType: input.taskType,
      input: input.input,
      actionKind: input.actionKind,
      approval: input.approval
    });

    let finalResult = result;
    if (result.status === "blocked" && result.error?.code === "approval_required") {
      const approvalId = this.ensureApprovalRequest({
        orgId: input.orgId,
        workerId: input.workerId,
        taskId: input.taskId,
        taskType: input.taskType,
        input: input.input
      });
      finalResult = {
        ...result,
        output: { approvalId }
      };
      this.recordAudit(input.orgId, "task_blocked", {
        workerId: input.workerId,
        taskId: input.taskId,
        approvalId,
        action: input.taskType,
        outcome: "approval_required"
      });
    } else {
      this.recordTaskOutcome(input.orgId, input.taskType, finalResult);
    }

    this.taskResults.set(this.taskKey(input.orgId, input.taskId), finalResult);
    return finalResult;
  }

  async getTaskResult(
    orgId: string,
    taskId: string
  ): Promise<WorkerTaskResult | undefined> {
    return this.taskResults.get(this.taskKey(orgId, taskId));
  }

  async listApprovals(
    orgId: string,
    status?: ApprovalRequestStatus
  ): Promise<ApprovalRequest[]> {
    return this.approvals.list(orgId, status ? { status } : undefined);
  }

  async listAudit(orgId: string): Promise<AuditRecord[]> {
    return this.audit.list(orgId);
  }

  async decideApproval(input: {
    orgId: string;
    approvalId: string;
    decision: "approve" | "deny";
    decidedBy: string;
  }): Promise<ApprovalDecisionResult> {
    const current = this.approvals.get(input.approvalId);
    if (!current || current.orgId !== input.orgId) {
      throw new Error(`Approval request not found: ${input.approvalId}`);
    }

    if (input.decision === "deny") {
      const approval = this.approvals.deny(input.approvalId, input.decidedBy);
      this.recordAudit(input.orgId, "approval_denied", {
        actorId: input.decidedBy,
        workerId: current.workerId,
        taskId: current.taskId,
        approvalId: current.id,
        action: current.taskType,
        outcome: "denied",
        metadata: { policyId: current.policyId }
      });
      const deniedResult: WorkerTaskResult = {
        workerId: current.workerId,
        taskId: current.taskId,
        status: "cancelled",
        error: {
          code: "approval_denied",
          message: `Approval denied by ${input.decidedBy}`,
          retryable: false
        },
        completedAt: approval.decidedAt ?? new Date().toISOString()
      };
      this.taskResults.set(this.taskKey(input.orgId, current.taskId), deniedResult);
      this.recordTaskOutcome(input.orgId, current.taskType, deniedResult, current.id);
      return { approval, taskResult: deniedResult };
    }

    const approval = this.approvals.approve(input.approvalId, input.decidedBy);
    this.recordAudit(input.orgId, "approval_approved", {
      actorId: input.decidedBy,
      workerId: current.workerId,
      taskId: current.taskId,
      approvalId: current.id,
      action: current.taskType,
      outcome: "approved",
      metadata: { policyId: current.policyId }
    });
    const bootstrap = this.orgs.get(input.orgId);
    if (!bootstrap) {
      throw new Error(`Real Estate Pack is not installed for org ${input.orgId}`);
    }

    const taskResult = await bootstrap.service.runWorkerTask({
      workerId: current.workerId,
      taskId: current.taskId,
      taskType: current.taskType,
      input: current.input,
      actionKind: "write",
      approval: {
        granted: true,
        approvalId: approval.id,
        approvedBy: approval.decidedBy,
        approvedAt: approval.decidedAt
      }
    });
    this.taskResults.set(this.taskKey(input.orgId, current.taskId), taskResult);
    this.recordTaskOutcome(input.orgId, current.taskType, taskResult, current.id);
    return { approval, taskResult };
  }

  async stopOrg(orgId: string): Promise<void> {
    const bootstrap = this.orgs.get(orgId);
    if (!bootstrap) {
      return;
    }
    await bootstrap.service.stop();
    this.orgs.delete(orgId);
  }

  private ensureApprovalRequest(input: {
    orgId: string;
    workerId: string;
    taskId: string;
    taskType: string;
    input: unknown;
  }): string {
    const taskKey = this.taskKey(input.orgId, input.taskId);
    const existingId = this.approvalIdByTask.get(taskKey);
    if (existingId) {
      return existingId;
    }

    const approvalId = `approval-${input.orgId}-${input.taskId}`;
    const bootstrap = this.orgs.get(input.orgId);
    const worker = [bootstrap?.acquisitionsWorker, bootstrap?.researchWorker].find(
      (candidate) => candidate?.id === input.workerId
    );
    const policyId = worker?.approvalPolicy.policyId ?? "unknown-policy";

    this.approvals.create({
      id: approvalId,
      orgId: input.orgId,
      workerId: input.workerId,
      taskId: input.taskId,
      taskType: input.taskType,
      input: input.input,
      policyId,
      metadata: { actionKind: "write" }
    });
    this.approvalIdByTask.set(taskKey, approvalId);
    this.recordAudit(input.orgId, "approval_requested", {
      workerId: input.workerId,
      taskId: input.taskId,
      approvalId,
      action: input.taskType,
      outcome: "pending",
      metadata: { policyId }
    });
    return approvalId;
  }

  private recordTaskOutcome(
    orgId: string,
    taskType: string,
    result: WorkerTaskResult,
    approvalId?: string
  ): void {
    const kind: AuditRecordKind =
      result.status === "completed"
        ? "task_completed"
        : result.status === "cancelled"
          ? "task_cancelled"
          : "task_failed";
    this.recordAudit(orgId, kind, {
      workerId: result.workerId,
      taskId: result.taskId,
      approvalId,
      action: taskType,
      outcome: result.status,
      metadata: result.error?.code ? { errorCode: result.error.code } : undefined
    });
  }

  private recordAudit(
    orgId: string,
    kind: AuditRecordKind,
    details: Omit<AuditRecord, "id" | "orgId" | "kind" | "timestamp">
  ): void {
    this.auditSequence += 1;
    this.audit.append({
      id: `audit-${this.auditSequence}`,
      orgId,
      kind,
      ...details
    });
  }

  private taskKey(orgId: string, taskId: string): string {
    return `${orgId}:${taskId}`;
  }
}
