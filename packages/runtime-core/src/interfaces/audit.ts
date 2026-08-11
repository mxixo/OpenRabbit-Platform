export type AuditRecordKind =
  | "task_requested"
  | "task_blocked"
  | "task_completed"
  | "task_failed"
  | "task_cancelled"
  | "approval_requested"
  | "approval_approved"
  | "approval_denied";

export interface AuditRecord {
  id: string;
  orgId: string;
  kind: AuditRecordKind;
  timestamp: string;
  actorId?: string;
  workerId?: string;
  taskId?: string;
  approvalId?: string;
  action?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRecordFilter {
  kind?: AuditRecordKind;
  workerId?: string;
  taskId?: string;
  approvalId?: string;
}

export interface AuditStore {
  append(input: Omit<AuditRecord, "timestamp"> & { timestamp?: string }): AuditRecord;
  list(orgId: string, filter?: AuditRecordFilter): AuditRecord[];
}
