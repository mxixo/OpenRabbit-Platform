import { describe, expect, it } from "vitest";
import { InMemoryPersistenceAdapter } from "../../src/persistence/in-memory-persistence.js";
import { PersistentMemoryRepository } from "../../src/storage/persistent-memory-repository.js";

describe("persistent memory repository", () => {
  it("loads initial records from persistence and supports reads", async () => {
    const persistence = new InMemoryPersistenceAdapter([
      {
        id: "seed-1",
        namespace: "tenant:seed",
        content: "seeded memory",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();
    await expect(repository.get("seed-1")).resolves.toMatchObject({
      id: "seed-1",
      namespace: "tenant:seed"
    });
  });

  it("persists writes and deletes through the persistence adapter", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    await repository.put({
      id: "rec-1",
      namespace: "tenant:one",
      content: "first"
    });
    await repository.put({
      id: "rec-2",
      namespace: "tenant:one",
      content: "second"
    });
    await expect(repository.search({ namespace: "tenant:one" })).resolves.toHaveLength(2);

    await repository.delete("rec-1");
    await expect(repository.search({ namespace: "tenant:one" })).resolves.toHaveLength(1);
    const persistedRecords = await persistence.load();
    expect(persistedRecords.map((record) => record.id)).toEqual(["rec-2"]);
  });
});
