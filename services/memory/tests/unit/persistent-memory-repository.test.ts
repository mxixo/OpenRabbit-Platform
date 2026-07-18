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

  it("increments access metadata on get and search", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    await repository.put({
      id: "access-1",
      namespace: "tenant:access",
      content: "track accesses"
    });

    await repository.get("access-1");
    await repository.search({ namespace: "tenant:access" });
    const record = await repository.get("access-1");

    expect(record?.metadata?.accessCount).toBe(3);
    expect(record?.metadata?.lastAccessedAt).toBeDefined();
  });

  it("preserves provenance metadata while updating access counts", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    await repository.put({
      id: "prov-1",
      namespace: "tenant:prov",
      content: "memory with provenance",
      metadata: {
        reasoningHistory: [
          { stepId: "r-1", summary: "Compared options", timestamp: "2026-07-18T08:03:00.000Z" }
        ],
        decisionProvenance: {
          decisionId: "decision-xyz",
          decidedAt: "2026-07-18T08:03:30.000Z"
        }
      }
    });

    await repository.get("prov-1");
    const record = await repository.get("prov-1");

    expect(record?.metadata?.decisionProvenance).toMatchObject({
      decisionId: "decision-xyz"
    });
    expect(record?.metadata?.reasoningHistory).toMatchObject([
      { stepId: "r-1" }
    ]);
    expect(record?.metadata?.accessCount).toBe(2);
  });
});
