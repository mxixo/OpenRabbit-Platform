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
      ...normalizeRecord(record, now),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.records.set(record.id, nextRecord);
    await this.persistence.save(this.listRecords());
    return nextRecord;
  }

  async get(id: string): Promise<MemoryRecord | undefined> {
    this.ensureInitialized();
    const record = this.records.get(id);
    if (!record) {
      return undefined;
    }
    const next = markAccess(record);
    this.records.set(id, next);
    await this.persistence.save(this.listRecords());
    return next;
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    this.ensureInitialized();
    const limit = query.limit ?? 20;
    const now = new Date();
    const results = this.listRecords()
      .filter((record) => record.namespace === query.namespace)
      .filter((record) => (query.sessionId ? record.sessionId === query.sessionId : true))
      .filter((record) => (query.agentId ? record.agentId === query.agentId : true))
      .filter((record) => (query.domain ? record.domain === query.domain : true))
      .filter((record) =>
        query.text ? record.content.toLowerCase().includes(query.text.toLowerCase()) : true
      )
      .filter((record) =>
        query.minConfidenceScore !== undefined
          ? (record.quality?.confidence?.score ?? 0) >= query.minConfidenceScore
          : true
      )
      .sort((a, b) => computeSearchRank(b, now) - computeSearchRank(a, now))
      .slice(0, limit);
    if (results.length > 0) {
      for (const result of results) {
        this.records.set(result.id, markAccess(result));
      }
      await this.persistence.save(this.listRecords());
    }
    return results.map((result) => this.records.get(result.id) ?? result);
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

function normalizeRecord(
  record: Omit<MemoryRecord, "createdAt" | "updatedAt">,
  now: string
): Omit<MemoryRecord, "createdAt" | "updatedAt"> {
  return {
    ...record,
    domain: record.domain ?? "working",
    quality: {
      ...record.quality,
      freshnessTimestamp: record.quality?.freshnessTimestamp ?? now,
      consolidation: {
        accessCount: record.quality?.consolidation?.accessCount ?? 0,
        ...record.quality?.consolidation
      }
    }
  };
}

function markAccess(record: MemoryRecord): MemoryRecord {
  const now = new Date().toISOString();
  const accessCount = (record.quality?.consolidation?.accessCount ?? 0) + 1;
  return {
    ...record,
    quality: {
      ...record.quality,
      consolidation: {
        ...record.quality?.consolidation,
        accessCount,
        lastAccessedAt: now
      }
    }
  };
}

function computeSearchRank(record: MemoryRecord, now: Date): number {
  const confidence = record.quality?.confidence?.score ?? 0;
  const freshnessIso = record.quality?.freshnessTimestamp ?? record.updatedAt;
  const freshnessMs = Date.parse(freshnessIso);
  const freshnessScore = Number.isNaN(freshnessMs) ? 0 : freshnessMs / 1000;
  const stalePenalty = isStale(record, now) ? 1_000_000_000 : 0;
  return freshnessScore + confidence * 1000 - stalePenalty;
}

function isStale(record: MemoryRecord, now: Date): boolean {
  const decayPolicy = record.quality?.decayPolicy;
  if (!decayPolicy) {
    return false;
  }
  if (decayPolicy.expiresAt) {
    const expiresAtMs = Date.parse(decayPolicy.expiresAt);
    if (!Number.isNaN(expiresAtMs) && now.getTime() > expiresAtMs) {
      return true;
    }
  }
  if (!decayPolicy.staleAfterSeconds) {
    return false;
  }
  const freshnessIso = record.quality?.freshnessTimestamp ?? record.updatedAt;
  const freshnessMs = Date.parse(freshnessIso);
  if (Number.isNaN(freshnessMs)) {
    return false;
  }
  return now.getTime() - freshnessMs > decayPolicy.staleAfterSeconds * 1000;
}
