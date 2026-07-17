import {
  MemoryQuery,
  MemoryRecord,
  MemoryStore
} from "../interfaces/memory.js";

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): MemoryRecord {
    const now = new Date().toISOString();
    const existing = this.records.get(record.id);
    const createdAt = existing?.createdAt ?? now;

    const next: MemoryRecord = {
      ...record,
      createdAt,
      updatedAt: now
    };
    this.records.set(record.id, next);
    return next;
  }

  get(id: string): MemoryRecord | undefined {
    return this.records.get(id);
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  search(query: MemoryQuery): MemoryRecord[] {
    const limit = query.limit ?? 20;
    return [...this.records.values()]
      .filter((record) => record.namespace === query.namespace)
      .filter((record) => (query.sessionId ? record.sessionId === query.sessionId : true))
      .filter((record) =>
        query.text ? record.content.toLowerCase().includes(query.text.toLowerCase()) : true
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
}
