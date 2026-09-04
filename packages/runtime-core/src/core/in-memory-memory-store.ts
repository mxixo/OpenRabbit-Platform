import {
  MemoryQuery,
  MemoryRecord,
  MemoryRecordAddress,
  MemoryStore
} from "../interfaces/memory.js";

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): MemoryRecord {
    assertMemoryScope(record);
    const now = new Date().toISOString();
    const key = memoryKey(record);
    const existing = this.records.get(key);
    const createdAt = existing?.createdAt ?? now;

    const next: MemoryRecord = {
      ...record,
      createdAt,
      updatedAt: now
    };
    this.records.set(key, cloneMemoryRecord(next));
    return cloneMemoryRecord(next);
  }

  get(address: MemoryRecordAddress): MemoryRecord | undefined {
    assertMemoryScope(address);
    const record = this.records.get(memoryKey(address));
    return record ? cloneMemoryRecord(record) : undefined;
  }

  delete(address: MemoryRecordAddress): boolean {
    assertMemoryScope(address);
    return this.records.delete(memoryKey(address));
  }

  search(query: MemoryQuery): MemoryRecord[] {
    assertMemoryPartition(query);
    const limit = query.limit ?? 20;
    return [...this.records.values()]
      .filter((record) => record.orgId === query.orgId)
      .filter((record) => record.namespace === query.namespace)
      .filter((record) => (query.sessionId ? record.sessionId === query.sessionId : true))
      .filter((record) =>
        query.text ? record.content.toLowerCase().includes(query.text.toLowerCase()) : true
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(cloneMemoryRecord);
  }
}

function memoryKey(address: MemoryRecordAddress): string {
  return JSON.stringify([address.orgId, address.namespace, address.id]);
}

function cloneMemoryRecord(record: MemoryRecord): MemoryRecord {
  return JSON.parse(JSON.stringify(record)) as MemoryRecord;
}

function assertMemoryScope(address: Partial<MemoryRecordAddress>): void {
  if (
    !isNonBlankString(address.orgId) ||
    !isNonBlankString(address.namespace) ||
    !isNonBlankString(address.id)
  ) {
    throw new Error("memory access requires orgId, namespace, and id");
  }
}

function assertMemoryPartition(
  partition: Partial<Pick<MemoryQuery, "orgId" | "namespace">>
): void {
  if (!isNonBlankString(partition.orgId) || !isNonBlankString(partition.namespace)) {
    throw new Error("memory query requires orgId and namespace");
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
