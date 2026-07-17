import { describe, expect, it } from "vitest";
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
});
