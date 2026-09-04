import {
  MemoryQuery,
  MemoryRecord,
  MemoryRecordAddress,
  ServiceReliabilitySnapshot
} from "@openrabbit/runtime-core";

export interface MemoryAccessContext {
  orgId: string;
  subjectId: string;
  namespace: string;
}

export type MemoryQueryInput = Omit<MemoryQuery, "orgId" | "namespace">;
export type MemoryRecordInputAddress = Omit<MemoryRecordAddress, "orgId" | "namespace">;

export interface ServiceDescriptor {
  serviceName: "memory";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface MemoryWriteInput {
  id: string;
  sessionId?: string;
  content: string;
  reasoningHistory?: ReasoningHistoryEntry[];
  decisionProvenance?: DecisionProvenance;
  metadata?: Record<string, unknown>;
}

export interface ReasoningHistoryEntry {
  stepId: string;
  summary: string;
  timestamp: string;
  confidence?: number;
  evidenceMemoryIds?: string[];
}

export interface DecisionProvenance {
  decisionId: string;
  traceId?: string;
  model?: string;
  policyVersion?: string;
  rationale?: string;
  evidenceMemoryIds?: string[];
  decidedAt: string;
}

export interface MemoryWriteResult {
  saved: boolean;
  record?: MemoryRecord;
  reason?: string;
}

export interface MemoryDeleteResult {
  deleted: boolean;
  reason?: string;
}

export interface MemoryConsolidationRequest {
  sessionId?: string;
  minAccessCount?: number;
  maxPromotions?: number;
}

export interface MemoryConsolidationResult {
  promotedCount: number;
  promotedRecordIds: string[];
}
export interface MemoryRepository {
  initialize(): Promise<void>;
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord>;
  get(address: MemoryRecordAddress): Promise<MemoryRecord | undefined>;
  search(query: MemoryQuery): Promise<MemoryRecord[]>;
  delete(address: MemoryRecordAddress): Promise<boolean>;
}

export interface MemoryPersistenceAdapter {
  load(): Promise<MemoryRecord[]>;
  save(records: MemoryRecord[]): Promise<void>;
}

export interface MemoryServiceOptions {
  repository?: MemoryRepository;
  persistence?: MemoryPersistenceAdapter;
  persistenceMode?: "in-memory" | "json-file";
  persistenceFilePath?: string;
}

export interface MemoryService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  putMemory(context: MemoryAccessContext, input: MemoryWriteInput): Promise<MemoryWriteResult>;
  getMemory(
    context: MemoryAccessContext,
    address: MemoryRecordInputAddress
  ): Promise<MemoryRecord | undefined>;
  searchMemory(context: MemoryAccessContext, query: MemoryQueryInput): Promise<MemoryRecord[]>;
  deleteMemory(
    context: MemoryAccessContext,
    address: MemoryRecordInputAddress
  ): Promise<MemoryDeleteResult>;
  consolidateMemory(
    context: MemoryAccessContext,
    request: MemoryConsolidationRequest
  ): Promise<MemoryConsolidationResult>;
}
