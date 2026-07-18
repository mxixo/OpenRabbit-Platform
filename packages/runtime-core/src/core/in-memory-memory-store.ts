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
      ...normalizeRecord(record, now),
      createdAt,
      updatedAt: now
    };
    this.records.set(record.id, next);
    return next;
  }

  get(id: string): MemoryRecord | undefined {
    const record = this.records.get(id);
    if (!record) {
      return undefined;
    }
    const next = markAccess(record);
    this.records.set(id, next);
    return next;
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  search(query: MemoryQuery): MemoryRecord[] {
    const limit = query.limit ?? 20;
    const now = new Date();
    return [...this.records.values()]
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
