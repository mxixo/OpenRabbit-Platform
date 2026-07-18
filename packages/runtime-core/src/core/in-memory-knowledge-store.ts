import {
  KnowledgeEntity,
  KnowledgeQuery,
  KnowledgeRecord,
  KnowledgeRelationship,
  KnowledgeSearchResult,
  KnowledgeStore
} from "../interfaces/knowledge.js";

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly records = new Map<string, KnowledgeRecord>();
  private readonly entities = new Map<string, KnowledgeEntity>();
  private readonly relationships = new Map<string, KnowledgeRelationship>();

  putRecord(record: Omit<KnowledgeRecord, "createdAt" | "updatedAt">): KnowledgeRecord {
    const now = new Date().toISOString();
    const existing = this.records.get(record.id);
    const next: KnowledgeRecord = {
      ...normalizeRecord(record, now),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.records.set(record.id, next);
    return next;
  }

  getRecord(id: string): KnowledgeRecord | undefined {
    return this.records.get(id);
  }

  search(query: KnowledgeQuery): KnowledgeSearchResult[] {
    const topK = query.topK ?? 10;
    const now = new Date();
    const scored = [...this.records.values()]
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
    return scored;
  }

  deleteRecord(id: string): boolean {
    return this.records.delete(id);
  }

  upsertEntity(entity: Omit<KnowledgeEntity, "createdAt" | "updatedAt">): KnowledgeEntity {
    const now = new Date().toISOString();
    const existing = this.entities.get(entity.id);
    const next: KnowledgeEntity = {
      ...entity,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.entities.set(entity.id, next);
    return next;
  }

  upsertRelationship(
    relationship: Omit<KnowledgeRelationship, "createdAt" | "updatedAt">
  ): KnowledgeRelationship {
    const now = new Date().toISOString();
    const existing = this.relationships.get(relationship.id);
    const next: KnowledgeRelationship = {
      ...relationship,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.relationships.set(relationship.id, next);
    return next;
  }

  listRelationships(namespace: string, entityId: string): KnowledgeRelationship[] {
    return [...this.relationships.values()]
      .filter((relationship) => relationship.namespace === namespace)
      .filter(
        (relationship) =>
          relationship.fromEntityId === entityId || relationship.toEntityId === entityId
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
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
