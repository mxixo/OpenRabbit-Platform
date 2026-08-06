import { MemoryRecord } from "@openrabbit/runtime-core";
import { MemoryPersistenceAdapter } from "../contracts.js";

export class InMemoryPersistenceAdapter implements MemoryPersistenceAdapter {
  private records: MemoryRecord[];

  constructor(initialRecords: MemoryRecord[] = []) {
    this.records = [...initialRecords];
  }

  async load(): Promise<MemoryRecord[]> {
    return [...this.records];
  }

  async save(records: MemoryRecord[]): Promise<void> {
    this.records = [...records];
  }
}
