export interface MemoryRecord {
  id: string;
  orgId: string;
  namespace: string;
  sessionId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryQuery {
  orgId: string;
  namespace: string;
  sessionId?: string;
  text?: string;
  limit?: number;
}

export interface MemoryRecordAddress {
  orgId: string;
  namespace: string;
  id: string;
}

export interface MemoryStore {
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): MemoryRecord;
  get(address: MemoryRecordAddress): MemoryRecord | undefined;
  delete(address: MemoryRecordAddress): boolean;
  search(query: MemoryQuery): MemoryRecord[];
}
