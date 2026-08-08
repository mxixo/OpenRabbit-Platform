import {
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRequestStore
} from "../interfaces/approval.js";

function cloneApproval(request: ApprovalRequest): ApprovalRequest {
  return {
    ...request,
    metadata: request.metadata ? { ...request.metadata } : undefined
  };
}

export class InMemoryApprovalRequestStore implements ApprovalRequestStore {
  private readonly requests = new Map<string, ApprovalRequest>();

  create(
    input: Omit<
      ApprovalRequest,
      "status" | "requestedAt" | "decidedAt" | "decidedBy"
    >
  ): ApprovalRequest {
    if (!input.id?.trim()) throw new Error("approval id is required");
    if (!input.orgId?.trim()) throw new Error("approval orgId is required");
    if (!input.workerId?.trim()) throw new Error("approval workerId is required");
    if (!input.taskId?.trim()) throw new Error("approval taskId is required");
    if (!input.taskType?.trim()) throw new Error("approval taskType is required");
    if (!input.policyId?.trim()) throw new Error("approval policyId is required");
    if (this.requests.has(input.id)) {
      throw new Error(`Approval request already exists: ${input.id}`);
    }

    const request: ApprovalRequest = {
      ...input,
      status: "pending",
      requestedAt: new Date().toISOString(),
      metadata: input.metadata ? { ...input.metadata } : undefined
    };
    this.requests.set(request.id, request);
    return cloneApproval(request);
  }

  get(approvalId: string): ApprovalRequest | undefined {
    const request = this.requests.get(approvalId);
    return request ? cloneApproval(request) : undefined;
  }

  list(
    orgId: string,
    filter?: { status?: ApprovalRequestStatus }
  ): ApprovalRequest[] {
    return [...this.requests.values()]
      .filter((request) => {
        if (request.orgId !== orgId) return false;
        if (filter?.status && request.status !== filter.status) return false;
        return true;
      })
      .map(cloneApproval);
  }

  approve(approvalId: string, decidedBy: string): ApprovalRequest {
    return this.decide(approvalId, "approved", decidedBy);
  }

  deny(approvalId: string, decidedBy: string): ApprovalRequest {
    return this.decide(approvalId, "denied", decidedBy);
  }

  private decide(
    approvalId: string,
    status: "approved" | "denied",
    decidedBy: string
  ): ApprovalRequest {
    const current = this.requests.get(approvalId);
    if (!current) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }
    if (current.status !== "pending") {
      throw new Error(
        `Approval request ${approvalId} is already ${current.status}`
      );
    }
    if (!decidedBy?.trim()) {
      throw new Error("decidedBy is required");
    }

    const next: ApprovalRequest = {
      ...current,
      status,
      decidedAt: new Date().toISOString(),
      decidedBy
    };
    this.requests.set(approvalId, next);
    return cloneApproval(next);
  }
}
