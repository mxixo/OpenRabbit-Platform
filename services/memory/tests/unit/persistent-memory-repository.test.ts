import { describe, expect, it } from "vitest";
import { MemoryRecord } from "@openrabbit/runtime-core";
import { MemoryPersistenceAdapter } from "../../src/contracts.js";
import { InMemoryPersistenceAdapter } from "../../src/persistence/in-memory-persistence.js";
import { PersistentMemoryRepository } from "../../src/storage/persistent-memory-repository.js";

describe("persistent memory repository", () => {
  it("loads initial records from persistence and supports reads", async () => {
    const persistence = new InMemoryPersistenceAdapter([
      {
        id: "seed-1",
        orgId: "org-1",
        namespace: "tenant:seed",
        content: "seeded memory",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();
    await expect(
      repository.get({ orgId: "org-1", namespace: "tenant:seed", id: "seed-1" })
    ).resolves.toMatchObject({
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
      orgId: "org-1",
      namespace: "tenant:one",
      content: "first"
    });
    await repository.put({
      id: "rec-2",
      orgId: "org-1",
      namespace: "tenant:one",
      content: "second"
    });
    await expect(
      repository.search({ orgId: "org-1", namespace: "tenant:one" })
    ).resolves.toHaveLength(2);

    await repository.delete({ orgId: "org-1", namespace: "tenant:one", id: "rec-1" });
    await expect(
      repository.search({ orgId: "org-1", namespace: "tenant:one" })
    ).resolves.toHaveLength(1);
    const persistedRecords = await persistence.load();
    expect(persistedRecords.map((record) => record.id)).toEqual(["rec-2"]);
  });

  it("increments access metadata on get and search", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    await repository.put({
      id: "access-1",
      orgId: "org-1",
      namespace: "tenant:access",
      content: "track accesses"
    });

    const recordAddress = { orgId: "org-1", namespace: "tenant:access", id: "access-1" };
    await repository.get(recordAddress);
    await repository.search({ orgId: "org-1", namespace: "tenant:access" });
    const record = await repository.get(recordAddress);

    expect(record?.metadata?.accessCount).toBe(3);
    expect(record?.metadata?.lastAccessedAt).toBeDefined();
  });

  it("preserves provenance metadata while updating access counts", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    await repository.put({
      id: "prov-1",
      orgId: "org-1",
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

    const recordAddress = { orgId: "org-1", namespace: "tenant:prov", id: "prov-1" };
    await repository.get(recordAddress);
    const record = await repository.get(recordAddress);

    expect(record?.metadata?.decisionProvenance).toMatchObject({
      decisionId: "decision-xyz"
    });
    expect(record?.metadata?.reasoningHistory).toMatchObject([
      { stepId: "r-1" }
    ]);
    expect(record?.metadata?.accessCount).toBe(2);
  });

  it("retains identical ids in separate tenant partitions across reloads", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const first = new PersistentMemoryRepository(persistence);
    await first.initialize();
    await first.put({ id: "shared", orgId: "org-1", namespace: "worker", content: "one" });
    await first.put({ id: "shared", orgId: "org-2", namespace: "worker", content: "two" });

    const reloaded = new PersistentMemoryRepository(persistence);
    await reloaded.initialize();
    await expect(
      reloaded.get({ orgId: "org-1", namespace: "worker", id: "shared" })
    ).resolves.toMatchObject({ content: "one" });
    await expect(
      reloaded.get({ orgId: "org-2", namespace: "worker", id: "shared" })
    ).resolves.toMatchObject({ content: "two" });
  });

  it("rejects persisted records that do not have an organization scope", async () => {
    const persistence = new InMemoryPersistenceAdapter([
      {
        id: "legacy",
        namespace: "tenant:legacy",
        content: "unsafe legacy record",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      } as never
    ]);
    const repository = new PersistentMemoryRepository(persistence);

    await expect(repository.initialize()).rejects.toThrow(
      "requires orgId, namespace, and id"
    );
  });

  it("does not expose mutable repository or persistence references", async () => {
    const persistence = new InMemoryPersistenceAdapter();
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    const saved = await repository.put({
      id: "mutable",
      orgId: "org-1",
      namespace: "worker",
      content: "original",
      metadata: { nested: { value: "safe" } }
    });
    saved.orgId = "org-2";
    saved.content = "poisoned";
    (saved.metadata?.nested as { value: string }).value = "poisoned";

    const loaded = await persistence.load();
    loaded[0]!.content = "persistence-poison";

    await expect(
      repository.get({ orgId: "org-1", namespace: "worker", id: "mutable" })
    ).resolves.toMatchObject({
      orgId: "org-1",
      content: "original",
      metadata: { nested: { value: "safe" } }
    });
    await expect(repository.search({ orgId: "org-2", namespace: "worker" })).resolves.toEqual(
      []
    );
  });

  it("does not retain partially loaded records after initialization is retried", async () => {
    let loadCount = 0;
    const persistence: MemoryPersistenceAdapter = {
      async load() {
        loadCount += 1;
        return loadCount === 1
          ? [
              record("stale", "org-1", "worker"),
              { ...record("invalid", "org-1", "worker"), orgId: "" }
            ]
          : [];
      },
      async save() {}
    };
    const repository = new PersistentMemoryRepository(persistence);

    await expect(repository.initialize()).rejects.toThrow(
      "requires orgId, namespace, and id"
    );
    await repository.initialize();

    await expect(
      repository.get({ orgId: "org-1", namespace: "worker", id: "stale" })
    ).resolves.toBeUndefined();
  });

  it("serializes concurrent snapshots so records from both organizations survive reload", async () => {
    let persisted: MemoryRecord[] = [];
    let saveCount = 0;
    let signalFirstSave = (): void => undefined;
    let releaseFirstSave = (): void => undefined;
    const firstSaveStarted = new Promise<void>((resolve) => {
      signalFirstSave = resolve;
    });
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const persistence: MemoryPersistenceAdapter = {
      async load() {
        return JSON.parse(JSON.stringify(persisted)) as MemoryRecord[];
      },
      async save(records) {
        saveCount += 1;
        if (saveCount === 1) {
          signalFirstSave();
          await firstSaveGate;
        }
        persisted = JSON.parse(JSON.stringify(records)) as MemoryRecord[];
      }
    };
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    const firstPut = repository.put({
      id: "one",
      orgId: "org-1",
      namespace: "worker",
      content: "one"
    });
    await firstSaveStarted;
    const secondPut = repository.put({
      id: "two",
      orgId: "org-2",
      namespace: "worker",
      content: "two"
    });
    releaseFirstSave();
    await Promise.all([firstPut, secondPut]);

    const reloaded = new PersistentMemoryRepository(persistence);
    await reloaded.initialize();
    await expect(reloaded.search({ orgId: "org-1", namespace: "worker" })).resolves.toHaveLength(
      1
    );
    await expect(reloaded.search({ orgId: "org-2", namespace: "worker" })).resolves.toHaveLength(
      1
    );
  });

  it("rolls back in-memory state when persistence fails", async () => {
    let failNextSave = true;
    const persistence: MemoryPersistenceAdapter = {
      async load() {
        return [];
      },
      async save() {
        if (failNextSave) {
          failNextSave = false;
          throw new Error("save failed");
        }
      }
    };
    const repository = new PersistentMemoryRepository(persistence);
    await repository.initialize();

    await expect(
      repository.put({
        id: "rolled-back",
        orgId: "org-1",
        namespace: "worker",
        content: "must not survive"
      })
    ).rejects.toThrow("save failed");
    await expect(
      repository.get({ orgId: "org-1", namespace: "worker", id: "rolled-back" })
    ).resolves.toBeUndefined();
  });
});

function record(id: string, orgId: string, namespace: string): MemoryRecord {
  return {
    id,
    orgId,
    namespace,
    content: id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}
