export type ApprovalRequestStatus = "pending" | "approved" | "denied";

export interface ApprovalRequest {
  id: string;
  orgId: string;
  workerId: string;
  taskId: string;
  taskType: string;
  input: unknown;
  status: ApprovalRequestStatus;
  policyId: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalRequestStore {
  create(input: Omit<ApprovalRequest, "status" | "requestedAt" | "decidedAt" | "decidedBy">): ApprovalRequest;
  get(approvalId: string): ApprovalRequest | undefined;
  list(orgId: string, filter?: { status?: ApprovalRequestStatus }): ApprovalRequest[];
  approve(approvalId: string, decidedBy: string): ApprovalRequest;
  deny(approvalId: string, decidedBy: string): ApprovalRequest;
}
