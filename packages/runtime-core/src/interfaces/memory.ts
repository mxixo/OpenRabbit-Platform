export type MemoryDomain = "working" | "long-term" | "world" | "business";

export interface MemoryConfidenceScore {
  score: number;
  rationale?: string;
  inputs?: string[];
}

export interface MemoryDecayPolicy {
  staleAfterSeconds?: number;
  halfLifeSeconds?: number;
  expiresAt?: string;
}

export interface MemoryConsolidationMetadata {
  accessCount?: number;
  lastAccessedAt?: string;
  promotedAt?: string;
  promotedFromId?: string;
}

export interface MemoryProvenanceReference {
  traceId?: string;
  decisionId?: string;
  source?: string;
}

export interface MemoryQualityMetadata {
  confidence?: MemoryConfidenceScore;
  freshnessTimestamp?: string;
  decayPolicy?: MemoryDecayPolicy;
  consolidation?: MemoryConsolidationMetadata;
  provenance?: MemoryProvenanceReference;
}
export interface MemoryRecord {
  id: string;
  namespace: string;
  sessionId?: string;
  agentId?: string;
  domain?: MemoryDomain;
  content: string;
  quality?: MemoryQualityMetadata;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryQuery {
  namespace: string;
  sessionId?: string;
  agentId?: string;
  domain?: MemoryDomain;
  text?: string;
  minConfidenceScore?: number;
  limit?: number;
}

export interface MemoryStore {
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): MemoryRecord;
  get(id: string): MemoryRecord | undefined;
  delete(id: string): boolean;
  search(query: MemoryQuery): MemoryRecord[];
}
