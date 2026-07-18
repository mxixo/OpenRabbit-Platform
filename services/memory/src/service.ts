import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  MemoryQuery,
  MemoryRecord,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  DecisionProvenance,
  MemoryConsolidationRequest,
  MemoryConsolidationResult,
  MemoryDeleteResult,
  MemoryPersistenceAdapter,
  MemoryRepository,
  MemoryService,
  MemoryServiceOptions,
  MemoryWriteInput,
  ReasoningHistoryEntry,
  MemoryWriteResult,
  ServiceDescriptor,
  ServiceHealth
} from "./contracts.js";
import { InMemoryPersistenceAdapter } from "./persistence/in-memory-persistence.js";
import { JsonFilePersistenceAdapter } from "./persistence/json-file-persistence.js";
import { PersistentMemoryRepository } from "./storage/persistent-memory-repository.js";

export function createMemoryService(
  version = "0.1.0",
  options: MemoryServiceOptions = {}
): MemoryService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "memory"
    }
  });
  const eventBus = new InMemoryEventBus();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "memory"
  });
  const repository = options.repository ?? buildRepositoryFromPersistence(buildPersistenceAdapter(options));

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;
  let persistenceState: "ready" | "error" = "ready";

  const descriptor: ServiceDescriptor = {
    serviceName: "memory",
    version,
    capabilities: [
      "memory-put",
      "memory-get",
      "memory-search",
      "memory-delete",
      "memory-consolidate",
      "persistence"
    ]
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
      try {
        await repository.initialize();
        started = true;
        persistenceState = "ready";
        await logger.info("memory service started", { configKeys: config.keys() });
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_INIT_FAILED";
        persistenceState = "error";
        started = false;
        await logger.error("memory service failed to start", { error: toErrorMessage(error) });
      }
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
          { name: "memory-store", status: "up" },
          { name: "memory-persistence", status: persistenceState === "ready" ? "up" : "down" }
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
      try {
        const record = await repository.put({
          ...input,
          metadata: buildMemoryMetadata(input)
        });
        await eventBus.publish({
          type: "memory.record.upserted",
          payload: { id: record.id, namespace: record.namespace },
          timestamp: new Date().toISOString()
        });
        if (input.reasoningHistory || input.decisionProvenance) {
          await eventBus.publish({
            type: "memory.provenance.tracked",
            payload: {
              id: record.id,
              namespace: record.namespace,
              reasoningStepCount: input.reasoningHistory?.length ?? 0,
              decisionId: input.decisionProvenance?.decisionId
            },
            timestamp: new Date().toISOString()
          });
        }
        operationsSucceeded += 1;
        return { saved: true, record };
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_WRITE_FAILED";
        persistenceState = "error";
        await logger.error("memory write persistence failure", {
          error: toErrorMessage(error),
          id: input.id
        });
        return { saved: false, reason: "failed to persist memory record" };
      }
    },
    async getMemory(id: string): Promise<MemoryRecord | undefined> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return undefined;
      }
      try {
        const record = await repository.get(id);
        operationsSucceeded += 1;
        return record;
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_READ_FAILED";
        persistenceState = "error";
        await logger.error("memory read persistence failure", {
          error: toErrorMessage(error),
          id
        });
        return undefined;
      }
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
      try {
        const results = await repository.search(query);
        operationsSucceeded += 1;
        return results;
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_READ_FAILED";
        persistenceState = "error";
        await logger.error("memory search persistence failure", {
          error: toErrorMessage(error),
          namespace: query.namespace
        });
        return [];
      }
    },
    async deleteMemory(id: string): Promise<MemoryDeleteResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { deleted: false, reason: notStartedReason };
      }
      try {
        const deleted = await repository.delete(id);
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
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_WRITE_FAILED";
        persistenceState = "error";
        await logger.error("memory delete persistence failure", {
          error: toErrorMessage(error),
          id
        });
        return { deleted: false, reason: "failed to persist memory deletion" };
      }
    },
    async consolidateMemory(
      request: MemoryConsolidationRequest
    ): Promise<MemoryConsolidationResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { promotedCount: 0, promotedRecordIds: [] };
      }
      if (!request.namespace) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_CONSOLIDATION_REQUEST";
        return { promotedCount: 0, promotedRecordIds: [] };
      }
      const minAccessCount = request.minAccessCount ?? 3;
      const maxPromotions = request.maxPromotions ?? 50;
      try {
        const candidates = await repository.search({
          namespace: request.namespace,
          sessionId: request.sessionId,
          limit: maxPromotions * 5
        });
        const toPromote = candidates
          .filter((record) => isWorkingTier(record))
          .filter((record) => getAccessCount(record) >= minAccessCount)
          .slice(0, maxPromotions);
        const promotedRecordIds: string[] = [];
        for (const record of toPromote) {
          const promoted = await repository.put({
            ...record,
            metadata: {
              ...record.metadata,
              storageTier: "long-term",
              promotedAt: new Date().toISOString()
            }
          });
          promotedRecordIds.push(promoted.id);
        }
        if (promotedRecordIds.length > 0) {
          await eventBus.publish({
            type: "memory.records.consolidated",
            payload: {
              namespace: request.namespace,
              promotedRecordIds
            },
            timestamp: new Date().toISOString()
          });
        }
        operationsSucceeded += 1;
        return {
          promotedCount: promotedRecordIds.length,
          promotedRecordIds
        };
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_WRITE_FAILED";
        persistenceState = "error";
        await logger.error("memory consolidation persistence failure", {
          error: toErrorMessage(error),
          namespace: request.namespace
        });
        return { promotedCount: 0, promotedRecordIds: [] };
      }
    }
  };
}

function buildRepositoryFromPersistence(persistence: MemoryPersistenceAdapter): MemoryRepository {
  return new PersistentMemoryRepository(persistence);
}

function buildPersistenceAdapter(options: MemoryServiceOptions): MemoryPersistenceAdapter {
  if (options.persistence) {
    return options.persistence;
  }
  if (options.persistenceMode === "json-file") {
    if (!options.persistenceFilePath) {
      throw new Error("persistenceFilePath is required for json-file persistence mode");
    }
    return new JsonFilePersistenceAdapter(options.persistenceFilePath);
  }
  return new InMemoryPersistenceAdapter();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildMemoryMetadata(input: MemoryWriteInput): Record<string, unknown> {
  const reasoningHistory = normalizeReasoningHistory(input.reasoningHistory);
  const decisionProvenance = normalizeDecisionProvenance(input.decisionProvenance);
  return {
    storageTier: "working",
    accessCount: 0,
    ...input.metadata,
    reasoningHistory,
    decisionProvenance
  };
}

function getAccessCount(record: MemoryRecord): number {
  const raw = record.metadata?.accessCount;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function isWorkingTier(record: MemoryRecord): boolean {
  const tier = record.metadata?.storageTier;
  return tier === undefined || tier === "working";
}

function normalizeReasoningHistory(
  history: ReasoningHistoryEntry[] | undefined
): ReasoningHistoryEntry[] {
  if (!history) {
    return [];
  }
  return history.map((entry) => ({
    ...entry,
    evidenceMemoryIds: entry.evidenceMemoryIds ? [...entry.evidenceMemoryIds] : undefined
  }));
}

function normalizeDecisionProvenance(
  provenance: DecisionProvenance | undefined
): DecisionProvenance | undefined {
  if (!provenance) {
    return undefined;
  }
  return {
    ...provenance,
    evidenceMemoryIds: provenance.evidenceMemoryIds
      ? [...provenance.evidenceMemoryIds]
      : undefined
  };
}
