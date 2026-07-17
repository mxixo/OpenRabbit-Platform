import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MemoryRecord } from "../../../../packages/runtime-core/src/index.js";
import { MemoryPersistenceAdapter } from "../contracts.js";

export class JsonFilePersistenceAdapter implements MemoryPersistenceAdapter {
  constructor(private readonly filePath: string) {}

  async load(): Promise<MemoryRecord[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(contents) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("persisted memory file must contain an array");
      }
      return parsed as MemoryRecord[];
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }
      throw error;
    }
  }

  async save(records: MemoryRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2), "utf8");
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
