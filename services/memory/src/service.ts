import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  InMemoryMemoryStore,
  MemoryQuery,
  MemoryRecord,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  MemoryDeleteResult,
  MemoryService,
  MemoryWriteInput,
  MemoryWriteResult,
  ServiceDescriptor,
  ServiceHealth
} from "./contracts.js";

export function createMemoryService(version = "0.1.0"): MemoryService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "memory"
    }
  });
  const eventBus = new InMemoryEventBus();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "memory"
  });
  const store = new InMemoryMemoryStore();

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "memory",
    version,
    capabilities: ["memory-put", "memory-get", "memory-search", "memory-delete"]
  };

  const requiresStarted = (): string | undefined => {
    if (!started) {
      operationsFailed += 1;
      lastErrorCode = "SERVICE_NOT_STARTED";
      return "service not started";
    }
    return undefined;
  };

  return {
    async start(): Promise<void> {
      started = true;
      await logger.info("memory service started", { configKeys: config.keys() });
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("memory service stopped");
    },
    isStarted(): boolean {
      return started;
    },
    getDescriptor(): ServiceDescriptor {
      return descriptor;
    },
    getHealth(): ServiceHealth {
      return {
        status: started ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        dependencies: [
          { name: "configuration-manager", status: "up" },
          { name: "event-bus", status: "up" },
          { name: "memory-store", status: "up" }
        ]
      };
    },
    getReliabilitySnapshot(): ServiceReliabilitySnapshot {
      return {
        operationsSucceeded,
        operationsFailed,
        lastErrorCode
      };
    },
    async putMemory(input: MemoryWriteInput): Promise<MemoryWriteResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { saved: false, reason: notStartedReason };
      }
      if (!input.id || !input.namespace || !input.content) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_MEMORY_RECORD";
        return { saved: false, reason: "id, namespace, and content are required" };
      }
      const record = store.put(input);
      await eventBus.publish({
        type: "memory.record.upserted",
        payload: { id: record.id, namespace: record.namespace },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { saved: true, record };
    },
    async getMemory(id: string): Promise<MemoryRecord | undefined> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return undefined;
      }
      const record = store.get(id);
      operationsSucceeded += 1;
      return record;
    },
    async searchMemory(query: MemoryQuery): Promise<MemoryRecord[]> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return [];
      }
      if (!query.namespace) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_MEMORY_QUERY";
        return [];
      }
      const results = store.search(query);
      operationsSucceeded += 1;
      return results;
    },
    async deleteMemory(id: string): Promise<MemoryDeleteResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { deleted: false, reason: notStartedReason };
      }
      const deleted = store.delete(id);
      if (deleted) {
        await eventBus.publish({
          type: "memory.record.deleted",
          payload: { id },
          timestamp: new Date().toISOString()
        });
        operationsSucceeded += 1;
        return { deleted: true };
      }
      operationsFailed += 1;
      lastErrorCode = "MEMORY_RECORD_NOT_FOUND";
      return { deleted: false, reason: "memory record not found" };
    }
  };
}
