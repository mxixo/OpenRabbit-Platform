import { MemoryRecord } from "@openrabbit/runtime-core";
import { MemoryPersistenceAdapter } from "../contracts.js";

export class InMemoryPersistenceAdapter implements MemoryPersistenceAdapter {
  private records: MemoryRecord[];

  constructor(initialRecords: MemoryRecord[] = []) {
    this.records = cloneRecords(initialRecords);
  }

  async load(): Promise<MemoryRecord[]> {
    return cloneRecords(this.records);
  }

  async save(records: MemoryRecord[]): Promise<void> {
    this.records = cloneRecords(records);
  }
}

function cloneRecords(records: MemoryRecord[]): MemoryRecord[] {
  return JSON.parse(JSON.stringify(records)) as MemoryRecord[];
}
