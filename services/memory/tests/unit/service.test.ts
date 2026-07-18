import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryService } from "../../src/service.js";

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
      await service.putMemory({
        id: "m1",
        namespace: "tenant:a",
        content: "first memory"
      })
    ).toEqual({ saved: false, reason: "service not started" });

    await service.start();
    const writeResult = await service.putMemory({
      id: "m1",
      namespace: "tenant:a",
      sessionId: "s1",
      content: "first memory",
      metadata: { source: "test" }
    });
    expect(writeResult.saved).toBe(true);
    expect(writeResult.record?.id).toBe("m1");

    await expect(service.getMemory("m1")).resolves.toMatchObject({
      id: "m1",
      namespace: "tenant:a",
      sessionId: "s1",
      content: "first memory"
    });
    await expect(service.searchMemory({ namespace: "tenant:a", text: "first" })).resolves.toHaveLength(1);
  });

  it("deletes records and updates reliability metrics", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory({
      id: "m2",
      namespace: "tenant:b",
      content: "to delete"
    });

    await expect(service.deleteMemory("m2")).resolves.toEqual({ deleted: true });
    await expect(service.deleteMemory("missing")).resolves.toEqual({
      deleted: false,
      reason: "memory record not found"
    });
    expect(service.getReliabilitySnapshot().operationsSucceeded).toBeGreaterThan(0);
    expect(service.getReliabilitySnapshot().operationsFailed).toBeGreaterThan(0);
  });

  it("persists memory records with json-file mode across restarts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "memory-service-test-"));
    const filePath = join(dir, "memory-store.json");

    const firstService = createMemoryService("0.1.0", {
      persistenceMode: "json-file",
      persistenceFilePath: filePath
    });
    await firstService.start();
    await firstService.putMemory({
      id: "persist-1",
      namespace: "tenant:persist",
      content: "durable content"
    });
    await firstService.stop();

    const secondService = createMemoryService("0.1.0", {
      persistenceMode: "json-file",
      persistenceFilePath: filePath
    });
    await secondService.start();

    await expect(secondService.getMemory("persist-1")).resolves.toMatchObject({
      id: "persist-1",
      namespace: "tenant:persist",
      content: "durable content"
    });
  });

  it("promotes frequently accessed records to long-term storage", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory({
      id: "promote-1",
      namespace: "tenant:consolidate",
      content: "frequently retrieved memory"
    });
    await service.putMemory({
      id: "promote-2",
      namespace: "tenant:consolidate",
      content: "rarely retrieved memory"
    });

    await service.getMemory("promote-1");
    await service.getMemory("promote-1");
    await service.getMemory("promote-1");
    await service.getMemory("promote-2");

    await expect(
      service.consolidateMemory({
        namespace: "tenant:consolidate",
        minAccessCount: 4
      })
    ).resolves.toEqual({
      promotedCount: 1,
      promotedRecordIds: ["promote-1"]
    });

    await expect(service.getMemory("promote-1")).resolves.toMatchObject({
      id: "promote-1",
      metadata: {
        storageTier: "long-term"
      }
    });
  });

  it("tracks reasoning history and decision provenance on memory writes", async () => {
    const service = createMemoryService();
    await service.start();
    await service.putMemory({
      id: "prov-1",
      namespace: "tenant:provenance",
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

    await expect(service.getMemory("prov-1")).resolves.toMatchObject({
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
    await service.putMemory({
      id: "prov-promote-1",
      namespace: "tenant:provenance-promote",
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

    await service.getMemory("prov-promote-1");
    await service.getMemory("prov-promote-1");
    await service.getMemory("prov-promote-1");

    await service.consolidateMemory({
      namespace: "tenant:provenance-promote",
      minAccessCount: 4
    });

    await expect(service.getMemory("prov-promote-1")).resolves.toMatchObject({
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
    await service.putMemory({
      id: "no-promote-1",
      namespace: "tenant:consolidate-low",
      content: "insufficiently accessed memory"
    });
    await service.getMemory("no-promote-1");

    await expect(
      service.consolidateMemory({
        namespace: "tenant:consolidate-low",
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
