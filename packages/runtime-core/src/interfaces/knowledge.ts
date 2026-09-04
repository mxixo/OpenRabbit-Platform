export interface KnowledgeConfidenceScore {
  score: number;
  rationale?: string;
}

export interface KnowledgeDecayPolicy {
  staleAfterSeconds?: number;
  halfLifeSeconds?: number;
  expiresAt?: string;
}

export interface KnowledgeQualityMetadata {
  confidence?: KnowledgeConfidenceScore;
  freshnessTimestamp?: string;
  decayPolicy?: KnowledgeDecayPolicy;
}
export interface KnowledgeRecord {
  id: string;
  orgId: string;
  namespace: string;
  sourceId?: string;
  content: string;
  tags?: string[];
  quality?: KnowledgeQualityMetadata;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEntity {
  id: string;
  orgId: string;
  namespace: string;
  type: string;
  name: string;
  attributes?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRelationship {
  id: string;
  orgId: string;
  namespace: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeQuery {
  orgId: string;
  namespace: string;
  text?: string;
  embedding?: number[];
  tags?: string[];
  minConfidenceScore?: number;
  minScore?: number;
  topK?: number;
}

export interface KnowledgeRecordAddress {
  orgId: string;
  namespace: string;
  id: string;
}

export interface KnowledgeEntityAddress {
  orgId: string;
  namespace: string;
  entityId: string;
}

export interface KnowledgeSearchResult {
  record: KnowledgeRecord;
  score: number;
  signals: Array<"text" | "embedding" | "tag" | "confidence" | "decay">;
}

export interface KnowledgeStore {
  putRecord(record: Omit<KnowledgeRecord, "createdAt" | "updatedAt">): KnowledgeRecord;
  getRecord(address: KnowledgeRecordAddress): KnowledgeRecord | undefined;
  search(query: KnowledgeQuery): KnowledgeSearchResult[];
  deleteRecord(address: KnowledgeRecordAddress): boolean;
  upsertEntity(entity: Omit<KnowledgeEntity, "createdAt" | "updatedAt">): KnowledgeEntity;
  upsertRelationship(
    relationship: Omit<KnowledgeRelationship, "createdAt" | "updatedAt">
  ): KnowledgeRelationship;
  listRelationships(address: KnowledgeEntityAddress): KnowledgeRelationship[];
}
