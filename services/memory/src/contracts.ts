import { MemoryQuery, MemoryRecord, ServiceReliabilitySnapshot } from "../../../packages/runtime-core/src/index.js";

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
  namespace: string;
  sessionId?: string;
  content: string;
  metadata?: Record<string, unknown>;
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

export interface MemoryService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  putMemory(input: MemoryWriteInput): Promise<MemoryWriteResult>;
  getMemory(id: string): Promise<MemoryRecord | undefined>;
  searchMemory(query: MemoryQuery): Promise<MemoryRecord[]>;
  deleteMemory(id: string): Promise<MemoryDeleteResult>;
}
