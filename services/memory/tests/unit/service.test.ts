import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryRepository } from "../../src/contracts.js";
import { createMemoryService } from "../../src/service.js";

const context = (namespace: string) => ({ orgId: "org-1", subjectId: "user-1", namespace });
const address = (id: string) => ({ id });

describe("memory service scaffold", () => {
  it("manages lifecycle and descriptor", async () => {
    const service = createMemoryService();
    expect(service.getDescriptor().serviceName).toBe("memory");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
    await service.stop();
    expect(service.getHealth().status).toBe("degraded");
  });

  it("stores and retrieves memory records after startup", async () => {
    const service = createMemoryService();
    expect(
      await service.putMemory(context("tenant:a"), {
        id: "m1",
        content: "first memory"
      })
    ).toEqual({ saved: false, reason: "service not started" });

    await service.start();
    const writeResult = await service.putMemory(context("tenant:a"), {
      id: "m1",
      sessionId: "s1",
      content: "first memory",
      metadata: { source: "test" }
    });
    expect(writeResult.saved).toBe(true);
    expect(writeResult.record?.id).toBe("m1");

    await expect(service.getMemory(context("tenant:a"), address("m1"))).resolves.toMatchObject({
      id: "m1",
      namespace: "tenant:a",
      sessionId: "s1",
      content: "first memory"
    });
    await expect(
      service.searchMemory(context("tenant:a"), { text: "first" })
    ).resolves.toHaveLength(1);
  });

  it("deletes records and updates reliability metrics", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory(context("tenant:b"), {
      id: "m2",
      content: "to delete"
    });

    await expect(service.deleteMemory(context("tenant:b"), address("m2"))).resolves.toEqual({
      deleted: true
    });
    await expect(
      service.deleteMemory(context("tenant:b"), address("missing"))
    ).resolves.toEqual({
      deleted: false,
      reason: "memory record not found"
    });
    expect(service.getReliabilitySnapshot().operationsSucceeded).toBeGreaterThan(0);
    expect(service.getReliabilitySnapshot().operationsFailed).toBeGreaterThan(0);
  });

  it("keeps identical record ids isolated between authenticated organizations", async () => {
    const service = createMemoryService();
    const orgOneContext = context("worker");
    const otherContext = { orgId: "org-2", subjectId: "user-2", namespace: "worker" };
    await service.start();
    await service.putMemory(orgOneContext, {
      id: "shared",
      content: "organization one"
    });
    await service.putMemory(otherContext, {
      id: "shared",
      content: "organization two"
    });

    await expect(service.getMemory(orgOneContext, address("shared"))).resolves.toMatchObject({
      content: "organization one"
    });
    await expect(
      service.getMemory(otherContext, address("shared"))
    ).resolves.toMatchObject({ content: "organization two" });
    await expect(
      service.deleteMemory(orgOneContext, address("shared"))
    ).resolves.toEqual({ deleted: true });
    await expect(
      service.getMemory(otherContext, address("shared"))
    ).resolves.toMatchObject({ content: "organization two" });
  });

  it("binds namespace authority to trusted context", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory(context("worker:one"), {
      id: "same-org-secret",
      content: "worker one only"
    });

    await expect(
      service.getMemory(context("worker:two"), address("same-org-secret"))
    ).resolves.toBeUndefined();
    await expect(service.searchMemory(context("worker:two"), {})).resolves.toEqual([]);
  });

  it("rejects records returned outside the authenticated repository scope", async () => {
    let putCalls = 0;
    const foreignRecord = {
      id: "foreign",
      orgId: "org-2",
      namespace: "worker",
      content: "foreign secret",
      metadata: { accessCount: 99 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const repository: MemoryRepository = {
      async initialize() {},
      async put(record) {
        putCalls += 1;
        return { ...foreignRecord, id: record.id };
      },
      async get() {
        return foreignRecord;
      },
      async search() {
        return [foreignRecord];
      },
      async delete() {
        return false;
      }
    };
    const service = createMemoryService("0.1.0", { repository });
    const authorized = context("worker");
    await service.start();

    await expect(
      service.putMemory(authorized, { id: "requested", content: "safe" })
    ).resolves.toEqual({ saved: false, reason: "failed to persist memory record" });
    await expect(service.getMemory(authorized, address("foreign"))).resolves.toBeUndefined();
    await expect(service.searchMemory(authorized, {})).resolves.toEqual([]);
    const writesBeforeConsolidation = putCalls;
    await expect(
      service.consolidateMemory(authorized, { minAccessCount: 1 })
    ).resolves.toEqual({ promotedCount: 0, promotedRecordIds: [] });
    expect(putCalls).toBe(writesBeforeConsolidation);
  });

  it("persists memory records with json-file mode across restarts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "memory-service-test-"));
    const filePath = join(dir, "memory-store.json");

    const firstService = createMemoryService("0.1.0", {
      persistenceMode: "json-file",
      persistenceFilePath: filePath
    });
    await firstService.start();
    await firstService.putMemory(context("tenant:persist"), {
      id: "persist-1",
      content: "durable content"
    });
    await firstService.stop();

    const secondService = createMemoryService("0.1.0", {
      persistenceMode: "json-file",
      persistenceFilePath: filePath
    });
    await secondService.start();

    await expect(
      secondService.getMemory(context("tenant:persist"), address("persist-1"))
    ).resolves.toMatchObject({
      id: "persist-1",
      namespace: "tenant:persist",
      content: "durable content"
    });
  });

  it("promotes frequently accessed records to long-term storage", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory(context("tenant:consolidate"), {
      id: "promote-1",
      content: "frequently retrieved memory"
    });
    await service.putMemory(context("tenant:consolidate"), {
      id: "promote-2",
      content: "rarely retrieved memory"
    });

    await service.getMemory(context("tenant:consolidate"), address("promote-1"));
    await service.getMemory(context("tenant:consolidate"), address("promote-1"));
    await service.getMemory(context("tenant:consolidate"), address("promote-1"));
    await service.getMemory(context("tenant:consolidate"), address("promote-2"));

    await expect(
      service.consolidateMemory(context("tenant:consolidate"), {
        minAccessCount: 4
      })
    ).resolves.toEqual({
      promotedCount: 1,
      promotedRecordIds: ["promote-1"]
    });

    await expect(
      service.getMemory(context("tenant:consolidate"), address("promote-1"))
    ).resolves.toMatchObject({
      id: "promote-1",
      metadata: {
        storageTier: "long-term"
      }
    });
  });

  it("tracks reasoning history and decision provenance on memory writes", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory(context("tenant:provenance"), {
      id: "prov-1",
      content: "decision context memory",
      reasoningHistory: [
        {
          stepId: "step-1",
          summary: "Compared candidate outreach strategies",
          timestamp: "2026-07-18T08:00:00.000Z",
          confidence: 0.82,
          evidenceMemoryIds: ["m-evidence-1"]
        }
      ],
      decisionProvenance: {
        decisionId: "decision-1",
        traceId: "trace-1",
        model: "gpt-5.6-sol-medium",
        policyVersion: "policy-v3",
        rationale: "Selected the highest expected response rate option",
        evidenceMemoryIds: ["m-evidence-1", "m-evidence-2"],
        decidedAt: "2026-07-18T08:01:00.000Z"
      }
    });

    await expect(
      service.getMemory(context("tenant:provenance"), address("prov-1"))
    ).resolves.toMatchObject({
      id: "prov-1",
      metadata: {
        reasoningHistory: [
          {
            stepId: "step-1",
            summary: "Compared candidate outreach strategies"
          }
        ],
        decisionProvenance: {
          decisionId: "decision-1",
          traceId: "trace-1"
        }
      }
    });
  });

  it("preserves provenance metadata when records are promoted to long-term", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory(context("tenant:provenance-promote"), {
      id: "prov-promote-1",
      content: "memory with decision provenance",
      reasoningHistory: [
        {
          stepId: "s-1",
          summary: "Validated policy constraints",
          timestamp: "2026-07-18T08:02:00.000Z"
        }
      ],
      decisionProvenance: {
        decisionId: "decision-promote-1",
        decidedAt: "2026-07-18T08:02:30.000Z"
      }
    });

    await service.getMemory(
      context("tenant:provenance-promote"),
      address("prov-promote-1")
    );
    await service.getMemory(
      context("tenant:provenance-promote"),
      address("prov-promote-1")
    );
    await service.getMemory(
      context("tenant:provenance-promote"),
      address("prov-promote-1")
    );

    await service.consolidateMemory(context("tenant:provenance-promote"), {
      minAccessCount: 4
    });

    await expect(
      service.getMemory(context("tenant:provenance-promote"), address("prov-promote-1"))
    ).resolves.toMatchObject({
      id: "prov-promote-1",
      metadata: {
        storageTier: "long-term",
        decisionProvenance: {
          decisionId: "decision-promote-1"
        },
        reasoningHistory: [
          {
            stepId: "s-1"
          }
        ]
      }
    });
  });

  it("does not promote records below consolidation threshold", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory(context("tenant:consolidate-low"), {
      id: "no-promote-1",
      content: "insufficiently accessed memory"
    });
    await service.getMemory(context("tenant:consolidate-low"), address("no-promote-1"));

    await expect(
      service.consolidateMemory(context("tenant:consolidate-low"), {
        minAccessCount: 5
      })
    ).resolves.toEqual({
      promotedCount: 0,
      promotedRecordIds: []
    });
  });

  it("marks service degraded when persistence initialization fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "memory-service-bad-json-"));
    const filePath = join(dir, "broken-store.json");
    await writeFile(filePath, "{\"broken\":true}", "utf8");

    const service = createMemoryService("0.1.0", {
      persistenceMode: "json-file",
      persistenceFilePath: filePath
    });
    await service.start();
    expect(service.isStarted()).toBe(false);
    expect(service.getHealth().dependencies.find((dependency) => dependency.name === "memory-persistence")?.status).toBe("down");
    expect(service.getReliabilitySnapshot().lastErrorCode).toBe("PERSISTENCE_INIT_FAILED");
  });
});
