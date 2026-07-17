import { MemoryQuery, MemoryRecord } from "../../../../packages/runtime-core/src/index.js";
import { MemoryPersistenceAdapter, MemoryRepository } from "../contracts.js";

export class PersistentMemoryRepository implements MemoryRepository {
  private readonly records = new Map<string, MemoryRecord>();
  private initialized = false;

  constructor(private readonly persistence: MemoryPersistenceAdapter) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const loadedRecords = await this.persistence.load();
    for (const record of loadedRecords) {
      this.records.set(record.id, record);
    }
    this.initialized = true;
  }

  async put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord> {
    this.ensureInitialized();
    const now = new Date().toISOString();
    const existing = this.records.get(record.id);
    const nextRecord: MemoryRecord = {
      ...record,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.records.set(record.id, nextRecord);
    await this.persistence.save(this.listRecords());
    return nextRecord;
  }

  async get(id: string): Promise<MemoryRecord | undefined> {
    this.ensureInitialized();
    return this.records.get(id);
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    this.ensureInitialized();
    const limit = query.limit ?? 20;
    return this.listRecords()
      .filter((record) => record.namespace === query.namespace)
      .filter((record) => (query.sessionId ? record.sessionId === query.sessionId : true))
      .filter((record) =>
        query.text ? record.content.toLowerCase().includes(query.text.toLowerCase()) : true
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();
    const deleted = this.records.delete(id);
    if (deleted) {
      await this.persistence.save(this.listRecords());
    }
    return deleted;
  }

  private listRecords(): MemoryRecord[] {
    return [...this.records.values()];
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("memory repository not initialized");
    }
  }
}
