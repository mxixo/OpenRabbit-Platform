export interface MemoryRecord {
  id: string;
  namespace: string;
  sessionId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryQuery {
  namespace: string;
  sessionId?: string;
  text?: string;
  limit?: number;
}

export interface MemoryStore {
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): MemoryRecord;
  get(id: string): MemoryRecord | undefined;
  delete(id: string): boolean;
  search(query: MemoryQuery): MemoryRecord[];
}
