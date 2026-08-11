import type { AuditRecord, AuditRecordFilter, AuditStore } from "../interfaces/audit.js";

function cloneRecord(record: AuditRecord): AuditRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined
  };
}

export class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditRecord[] = [];

  append(
    input: Omit<AuditRecord, "timestamp"> & { timestamp?: string }
  ): AuditRecord {
    if (!input.id?.trim()) throw new Error("audit id is required");
    if (!input.orgId?.trim()) throw new Error("audit orgId is required");
    if (!input.kind) throw new Error("audit kind is required");
    if (this.records.some((record) => record.id === input.id)) {
      throw new Error(`Audit record already exists: ${input.id}`);
    }

    const record: AuditRecord = {
      ...input,
      timestamp: input.timestamp ?? new Date().toISOString(),
      metadata: input.metadata ? { ...input.metadata } : undefined
    };
    this.records.push(record);
    return cloneRecord(record);
  }

  list(orgId: string, filter?: AuditRecordFilter): AuditRecord[] {
    return this.records
      .filter((record) => {
        if (record.orgId !== orgId) return false;
        if (filter?.kind && record.kind !== filter.kind) return false;
        if (filter?.workerId && record.workerId !== filter.workerId) return false;
        if (filter?.taskId && record.taskId !== filter.taskId) return false;
        if (filter?.approvalId && record.approvalId !== filter.approvalId) return false;
        return true;
      })
      .map(cloneRecord);
  }
}
