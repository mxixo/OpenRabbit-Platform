import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  MemoryRecord,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "@openrabbit/runtime-core";
import {
  DecisionProvenance,
  MemoryAccessContext,
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

  const captureContext = (context: MemoryAccessContext): MemoryAccessContext | undefined => {
    const orgId = context?.orgId;
    const subjectId = context?.subjectId;
    const namespace = context?.namespace;
    if (
      isNonBlankString(orgId) &&
      isNonBlankString(subjectId) &&
      isNonBlankString(namespace)
    ) {
      return {
        orgId,
        subjectId,
        namespace
      };
    }
    operationsFailed += 1;
    lastErrorCode = "INVALID_MEMORY_ACCESS_CONTEXT";
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
    async putMemory(
      context: MemoryAccessContext,
      input: MemoryWriteInput
    ): Promise<MemoryWriteResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { saved: false, reason: notStartedReason };
      }
      const scope = captureContext(context);
      if (!scope) {
        return { saved: false, reason: "authenticated memory context is required" };
      }
      if (!input.id || !input.content) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_MEMORY_RECORD";
        return { saved: false, reason: "id and content are required" };
      }
      try {
        const record = cloneMemoryRecord(
          await repository.put({
            ...input,
            orgId: scope.orgId,
            namespace: scope.namespace,
            metadata: buildMemoryMetadata(input)
          })
        );
        assertRecordInContext(record, scope, input.id);
        await eventBus.publish({
          type: "memory.record.upserted",
          payload: { id: record.id, orgId: record.orgId, namespace: record.namespace },
          timestamp: new Date().toISOString()
        });
        if (input.reasoningHistory || input.decisionProvenance) {
          await eventBus.publish({
            type: "memory.provenance.tracked",
            payload: {
              id: record.id,
              orgId: record.orgId,
              namespace: record.namespace,
              reasoningStepCount: input.reasoningHistory?.length ?? 0,
              decisionId: input.decisionProvenance?.decisionId
            },
            timestamp: new Date().toISOString()
          });
        }
        operationsSucceeded += 1;
        return { saved: true, record: cloneMemoryRecord(record) };
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
    async getMemory(
      context: MemoryAccessContext,
      address
    ): Promise<MemoryRecord | undefined> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return undefined;
      }
      const scope = captureContext(context);
      if (!scope || !address?.id?.trim()) {
        return undefined;
      }
      try {
        const repositoryRecord = await repository.get({
          id: address.id,
          orgId: scope.orgId,
          namespace: scope.namespace
        });
        const record = repositoryRecord ? cloneMemoryRecord(repositoryRecord) : undefined;
        if (record) {
          assertRecordInContext(record, scope, address.id);
        }
        operationsSucceeded += 1;
        return record ? cloneMemoryRecord(record) : undefined;
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_READ_FAILED";
        persistenceState = "error";
        await logger.error("memory read persistence failure", {
          error: toErrorMessage(error),
          id: address.id
        });
        return undefined;
      }
    },
    async searchMemory(context: MemoryAccessContext, query): Promise<MemoryRecord[]> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return [];
      }
      const scope = captureContext(context);
      if (!scope) {
        return [];
      }
      try {
        const results = (await repository.search({
          ...query,
          orgId: scope.orgId,
          namespace: scope.namespace
        })).map(cloneMemoryRecord);
        for (const record of results) {
          assertRecordInContext(record, scope);
        }
        operationsSucceeded += 1;
        return results;
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "PERSISTENCE_READ_FAILED";
        persistenceState = "error";
        await logger.error("memory search persistence failure", {
          error: toErrorMessage(error),
          namespace: scope.namespace
        });
        return [];
      }
    },
    async deleteMemory(context: MemoryAccessContext, address): Promise<MemoryDeleteResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { deleted: false, reason: notStartedReason };
      }
      const scope = captureContext(context);
      if (!scope || !address?.id?.trim()) {
        return { deleted: false, reason: "memory record not found" };
      }
      try {
        const deleted = await repository.delete({
          id: address.id,
          orgId: scope.orgId,
          namespace: scope.namespace
        });
        if (deleted) {
          await eventBus.publish({
            type: "memory.record.deleted",
            payload: { id: address.id, orgId: scope.orgId, namespace: scope.namespace },
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
          id: address.id
        });
        return { deleted: false, reason: "failed to persist memory deletion" };
      }
    },
    async consolidateMemory(
      context: MemoryAccessContext,
      request: MemoryConsolidationRequest
    ): Promise<MemoryConsolidationResult> {
      const notStartedReason = requiresStarted();
      if (notStartedReason) {
        return { promotedCount: 0, promotedRecordIds: [] };
      }
      const scope = captureContext(context);
      if (!scope) {
        return { promotedCount: 0, promotedRecordIds: [] };
      }
      const minAccessCount = request.minAccessCount ?? 3;
      const maxPromotions = request.maxPromotions ?? 50;
      try {
        const candidates = (await repository.search({
          orgId: scope.orgId,
          namespace: scope.namespace,
          sessionId: request.sessionId,
          limit: maxPromotions * 5
        })).map(cloneMemoryRecord);
        for (const record of candidates) {
          assertRecordInContext(record, scope);
        }
        const toPromote = candidates
          .filter((record) => isWorkingTier(record))
          .filter((record) => getAccessCount(record) >= minAccessCount)
          .slice(0, maxPromotions);
        const promotedRecordIds: string[] = [];
        for (const record of toPromote) {
          const promoted = cloneMemoryRecord(
            await repository.put({
              ...record,
              metadata: {
                ...record.metadata,
                storageTier: "long-term",
                promotedAt: new Date().toISOString()
              }
            })
          );
          assertRecordInContext(promoted, scope, record.id);
          promotedRecordIds.push(promoted.id);
        }
        if (promotedRecordIds.length > 0) {
          await eventBus.publish({
            type: "memory.records.consolidated",
            payload: {
              namespace: scope.namespace,
              orgId: scope.orgId,
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
          namespace: scope.namespace
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

function assertRecordInContext(
  record: MemoryRecord,
  context: MemoryAccessContext,
  expectedId?: string
): void {
  if (
    record.orgId !== context.orgId ||
    record.namespace !== context.namespace ||
    (expectedId !== undefined && record.id !== expectedId)
  ) {
    throw new Error("memory repository returned a record outside the authenticated scope");
  }
}

function cloneMemoryRecord(record: MemoryRecord): MemoryRecord {
  return JSON.parse(JSON.stringify(record)) as MemoryRecord;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
