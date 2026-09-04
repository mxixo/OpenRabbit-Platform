import { MemoryQuery, MemoryRecord, MemoryRecordAddress } from "@openrabbit/runtime-core";
import { MemoryPersistenceAdapter, MemoryRepository } from "../contracts.js";

export class PersistentMemoryRepository implements MemoryRepository {
  private readonly records = new Map<string, MemoryRecord>();
  private initialized = false;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly persistence: MemoryPersistenceAdapter) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const loadedRecords = await this.persistence.load();
    const validatedRecords = new Map<string, MemoryRecord>();
    for (const record of loadedRecords) {
      assertScopedRecord(record);
      validatedRecords.set(memoryKey(record), cloneMemoryRecord(record));
    }
    this.records.clear();
    for (const [key, record] of validatedRecords) {
      this.records.set(key, record);
    }
    this.initialized = true;
  }

  async put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord> {
    this.ensureInitialized();
    assertScopedRecord(record);
    return this.runPersistedMutation(() => {
      const now = new Date().toISOString();
      const key = memoryKey(record);
      const existing = this.records.get(key);
      const nextRecord: MemoryRecord = {
        ...record,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      this.records.set(key, cloneMemoryRecord(nextRecord));
      return cloneMemoryRecord(nextRecord);
    });
  }

  async get(address: MemoryRecordAddress): Promise<MemoryRecord | undefined> {
    this.ensureInitialized();
    assertScopedRecord(address);
    return this.runExclusive(async () => {
      const key = memoryKey(address);
      const record = this.records.get(key);
      if (!record) {
        return undefined;
      }
      return this.persistMutation(() => {
        const touched = markAccess(record);
        this.records.set(key, touched);
        return cloneMemoryRecord(touched);
      });
    });
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    this.ensureInitialized();
    assertScopedPartition(query);
    return this.runExclusive(async () => {
      const limit = query.limit ?? 20;
      const results = this.listRecords()
        .filter((record) => record.orgId === query.orgId)
        .filter((record) => record.namespace === query.namespace)
        .filter((record) => (query.sessionId ? record.sessionId === query.sessionId : true))
        .filter((record) =>
          query.text ? record.content.toLowerCase().includes(query.text.toLowerCase()) : true
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
      if (results.length === 0) {
        return [];
      }
      return this.persistMutation(() => {
        for (const result of results) {
          this.records.set(memoryKey(result), markAccess(result));
        }
        return results.map((result) =>
          cloneMemoryRecord(this.records.get(memoryKey(result)) ?? result)
        );
      });
    });
  }

  async delete(address: MemoryRecordAddress): Promise<boolean> {
    this.ensureInitialized();
    assertScopedRecord(address);
    return this.runExclusive(async () => {
      const key = memoryKey(address);
      if (!this.records.has(key)) {
        return false;
      }
      return this.persistMutation(() => this.records.delete(key));
    });
  }

  private listRecords(): MemoryRecord[] {
    return [...this.records.values()].map(cloneMemoryRecord);
  }

  private async runPersistedMutation<T>(mutation: () => T): Promise<T> {
    return this.runExclusive(() => this.persistMutation(mutation));
  }

  private async persistMutation<T>(mutation: () => T): Promise<T> {
    const previousRecords = this.listRecords();
    const result = mutation();
    try {
      await this.persistence.save(this.listRecords());
      return result;
    } catch (error) {
      this.replaceRecords(previousRecords);
      throw error;
    }
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue;
    let release = (): void => undefined;
    this.operationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private replaceRecords(records: MemoryRecord[]): void {
    this.records.clear();
    for (const record of records) {
      this.records.set(memoryKey(record), cloneMemoryRecord(record));
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("memory repository not initialized");
    }
  }
}

function memoryKey(address: MemoryRecordAddress): string {
  return JSON.stringify([address.orgId, address.namespace, address.id]);
}

function assertScopedRecord(record: Partial<MemoryRecord>): asserts record is MemoryRecord {
  if (
    !isNonBlankString(record.orgId) ||
    !isNonBlankString(record.namespace) ||
    !isNonBlankString(record.id)
  ) {
    throw new Error("persisted memory record requires orgId, namespace, and id");
  }
}

function assertScopedPartition(record: Partial<Pick<MemoryRecord, "orgId" | "namespace">>): void {
  if (!isNonBlankString(record.orgId) || !isNonBlankString(record.namespace)) {
    throw new Error("memory query requires orgId and namespace");
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function markAccess(record: MemoryRecord): MemoryRecord {
  const now = new Date().toISOString();
  const currentAccessCount = readAccessCount(record.metadata);
  return {
    ...record,
    metadata: {
      ...record.metadata,
      accessCount: currentAccessCount + 1,
      lastAccessedAt: now
    },
    updatedAt: now
  };
}

function readAccessCount(metadata: Record<string, unknown> | undefined): number {
  const raw = metadata?.accessCount;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function cloneMemoryRecord(record: MemoryRecord): MemoryRecord {
  return JSON.parse(JSON.stringify(record)) as MemoryRecord;
}
