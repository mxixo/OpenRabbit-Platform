import {
  KnowledgeEntity,
  KnowledgeEntityAddress,
  KnowledgeQuery,
  KnowledgeRecord,
  KnowledgeRecordAddress,
  KnowledgeRelationship,
  KnowledgeSearchResult,
  KnowledgeStore
} from "../interfaces/knowledge.js";

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly records = new Map<string, KnowledgeRecord>();
  private readonly entities = new Map<string, KnowledgeEntity>();
  private readonly relationships = new Map<string, KnowledgeRelationship>();

  putRecord(record: Omit<KnowledgeRecord, "createdAt" | "updatedAt">): KnowledgeRecord {
    assertKnowledgeAddress(record);
    const now = new Date().toISOString();
    const key = knowledgeKey(record);
    const existing = this.records.get(key);
    const next: KnowledgeRecord = {
      ...normalizeRecord(record, now),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.records.set(key, cloneKnowledgeRecord(next));
    return cloneKnowledgeRecord(next);
  }

  getRecord(address: KnowledgeRecordAddress): KnowledgeRecord | undefined {
    assertKnowledgeAddress(address);
    const record = this.records.get(knowledgeKey(address));
    return record ? cloneKnowledgeRecord(record) : undefined;
  }

  search(query: KnowledgeQuery): KnowledgeSearchResult[] {
    assertKnowledgePartition(query);
    const topK = query.topK ?? 10;
    const now = new Date();
    const scored = [...this.records.values()]
      .filter((record) => record.orgId === query.orgId)
      .filter((record) => record.namespace === query.namespace)
      .filter((record) => matchesTagFilter(record, query.tags))
      .filter((record) =>
        query.minConfidenceScore !== undefined
          ? (record.quality?.confidence?.score ?? 0) >= query.minConfidenceScore
          : true
      )
      .map((record) => buildScore(record, query, now))
      .filter((result) =>
        query.minScore !== undefined ? result.score >= query.minScore : true
      )
      .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
      .slice(0, topK);
    return scored.map((result) => ({
      ...result,
      record: cloneKnowledgeRecord(result.record),
      signals: [...result.signals]
    }));
  }

  deleteRecord(address: KnowledgeRecordAddress): boolean {
    assertKnowledgeAddress(address);
    return this.records.delete(knowledgeKey(address));
  }

  upsertEntity(entity: Omit<KnowledgeEntity, "createdAt" | "updatedAt">): KnowledgeEntity {
    assertKnowledgeAddress(entity);
    const now = new Date().toISOString();
    const key = knowledgeKey(entity);
    const existing = this.entities.get(key);
    const next: KnowledgeEntity = {
      ...entity,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.entities.set(key, cloneKnowledgeEntity(next));
    return cloneKnowledgeEntity(next);
  }

  upsertRelationship(
    relationship: Omit<KnowledgeRelationship, "createdAt" | "updatedAt">
  ): KnowledgeRelationship {
    assertKnowledgeAddress(relationship);
    if (
      !isNonBlankString(relationship.fromEntityId) ||
      !isNonBlankString(relationship.toEntityId)
    ) {
      throw new Error("knowledge relationship requires both endpoint ids");
    }
    const now = new Date().toISOString();
    const key = knowledgeKey(relationship);
    const existing = this.relationships.get(key);
    const next: KnowledgeRelationship = {
      ...relationship,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.relationships.set(key, cloneKnowledgeRelationship(next));
    return cloneKnowledgeRelationship(next);
  }

  listRelationships(address: KnowledgeEntityAddress): KnowledgeRelationship[] {
    assertKnowledgePartition(address);
    if (!isNonBlankString(address.entityId)) {
      throw new Error("knowledge relationship lookup requires entityId");
    }
    return [...this.relationships.values()]
      .filter((relationship) => relationship.orgId === address.orgId)
      .filter((relationship) => relationship.namespace === address.namespace)
      .filter(
        (relationship) =>
          relationship.fromEntityId === address.entityId ||
          relationship.toEntityId === address.entityId
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(cloneKnowledgeRelationship);
  }
}

function knowledgeKey(address: {
  orgId: string;
  namespace: string;
  id: string;
}): string {
  return JSON.stringify([address.orgId, address.namespace, address.id]);
}

function matchesTagFilter(record: KnowledgeRecord, queryTags?: string[]): boolean {
  if (!queryTags || queryTags.length === 0) {
    return true;
  }
  const tags = new Set(record.tags ?? []);
  return queryTags.every((tag) => tags.has(tag));
}

function buildScore(
  record: KnowledgeRecord,
  query: KnowledgeQuery,
  now: Date
): KnowledgeSearchResult {
  const signals: KnowledgeSearchResult["signals"] = [];
  const textScore = scoreText(record.content, query.text);
  const embeddingScore = scoreEmbedding(record.embedding, query.embedding);
  const tagScore = query.tags && query.tags.length > 0 ? 0.1 : 0;
  const confidenceScore = record.quality?.confidence?.score ?? 0;
  const decay = decayMultiplier(record, now);

  if (textScore > 0) {
    signals.push("text");
  }
  if (embeddingScore > 0) {
    signals.push("embedding");
  }
  if (query.tags && query.tags.length > 0) {
    signals.push("tag");
  }
  if (confidenceScore > 0) {
    signals.push("confidence");
  }
  if (decay < 1) {
    signals.push("decay");
  }

  const baseScore = textScore + embeddingScore + tagScore + confidenceScore * 0.25;

  return {
    record,
    score: baseScore * decay,
    signals
  };
}

function normalizeRecord(
  record: Omit<KnowledgeRecord, "createdAt" | "updatedAt">,
  now: string
): Omit<KnowledgeRecord, "createdAt" | "updatedAt"> {
  return {
    ...record,
    quality: {
      ...record.quality,
      freshnessTimestamp: record.quality?.freshnessTimestamp ?? now
    }
  };
}

function decayMultiplier(record: KnowledgeRecord, now: Date): number {
  const decayPolicy = record.quality?.decayPolicy;
  if (!decayPolicy) {
    return 1;
  }
  const freshnessIso = record.quality?.freshnessTimestamp ?? record.updatedAt;
  const freshnessMs = Date.parse(freshnessIso);
  const ageSeconds = Number.isNaN(freshnessMs) ? 0 : (now.getTime() - freshnessMs) / 1000;
  let multiplier = 1;

  if (decayPolicy.expiresAt) {
    const expiresMs = Date.parse(decayPolicy.expiresAt);
    if (!Number.isNaN(expiresMs) && now.getTime() > expiresMs) {
      multiplier *= 0.1;
    }
  }

  if (decayPolicy.staleAfterSeconds && ageSeconds > decayPolicy.staleAfterSeconds) {
    multiplier *= 0.5;
  }

  if (decayPolicy.halfLifeSeconds && decayPolicy.halfLifeSeconds > 0 && ageSeconds > 0) {
    multiplier *= Math.pow(0.5, ageSeconds / decayPolicy.halfLifeSeconds);
  }

  return Math.max(multiplier, 0.01);
}

function scoreText(content: string, queryText?: string): number {
  if (!queryText) {
    return 0;
  }
  const normalizedContent = content.toLowerCase();
  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) {
    return 0;
  }
  let matched = 0;
  for (const token of queryTokens) {
    if (normalizedContent.includes(token)) {
      matched += 1;
    }
  }
  return matched / queryTokens.length;
}

function scoreEmbedding(recordEmbedding?: number[], queryEmbedding?: number[]): number {
  if (!recordEmbedding || !queryEmbedding || recordEmbedding.length !== queryEmbedding.length) {
    return 0;
  }
  const cosine = cosineSimilarity(recordEmbedding, queryEmbedding);
  return Number.isFinite(cosine) && cosine > 0 ? cosine : 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function cloneKnowledgeRecord(record: KnowledgeRecord): KnowledgeRecord {
  return JSON.parse(JSON.stringify(record)) as KnowledgeRecord;
}

function cloneKnowledgeEntity(entity: KnowledgeEntity): KnowledgeEntity {
  return JSON.parse(JSON.stringify(entity)) as KnowledgeEntity;
}

function cloneKnowledgeRelationship(
  relationship: KnowledgeRelationship
): KnowledgeRelationship {
  return JSON.parse(JSON.stringify(relationship)) as KnowledgeRelationship;
}

function assertKnowledgeAddress(address: {
  orgId?: string;
  namespace?: string;
  id?: string;
}): void {
  if (
    !isNonBlankString(address.orgId) ||
    !isNonBlankString(address.namespace) ||
    !isNonBlankString(address.id)
  ) {
    throw new Error("knowledge access requires orgId, namespace, and id");
  }
}

function assertKnowledgePartition(partition: {
  orgId?: string;
  namespace?: string;
}): void {
  if (!isNonBlankString(partition.orgId) || !isNonBlankString(partition.namespace)) {
    throw new Error("knowledge access requires orgId and namespace");
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
