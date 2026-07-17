import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  ServiceDescriptor,
  ServiceHealth,
  SkillDefinition,
  SkillExecutionRequest,
  SkillExecutionResult,
  SkillRuntimeHandler,
  SkillsService
} from "./contracts.js";

export function createSkillsService(version = "0.1.0"): SkillsService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "skills"
    }
  });
  const eventBus = new InMemoryEventBus();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "skills"
  });

  const skills = new Map<string, { definition: SkillDefinition; handler: SkillRuntimeHandler }>();
  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "skills",
    version,
    capabilities: ["skill-registration", "skill-list", "skill-execution", "skill-removal"]
  };

  const ensureStarted = (): string | undefined => {
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
      await logger.info("skills service started", { configKeys: config.keys() });
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("skills service stopped");
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
          { name: "skill-registry", status: "up" }
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
    async registerSkill(
      definition: SkillDefinition,
      handler: SkillRuntimeHandler
    ): Promise<{ registered: boolean; reason?: string }> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return { registered: false, reason: notStarted };
      }
      if (!definition.id || !definition.version || !definition.name) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_SKILL_DEFINITION";
        return { registered: false, reason: "id, version, and name are required" };
      }
      if (skills.has(definition.id)) {
        operationsFailed += 1;
        lastErrorCode = "SKILL_ALREADY_REGISTERED";
        return { registered: false, reason: "skill already registered" };
      }

      skills.set(definition.id, { definition, handler });
      await eventBus.publish({
        type: "skills.skill.registered",
        payload: { id: definition.id, version: definition.version },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { registered: true };
    },
    async unregisterSkill(skillId: string): Promise<{ removed: boolean; reason?: string }> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return { removed: false, reason: notStarted };
      }
      const removed = skills.delete(skillId);
      if (!removed) {
        operationsFailed += 1;
        lastErrorCode = "SKILL_NOT_FOUND";
        return { removed: false, reason: "skill not found" };
      }
      await eventBus.publish({
        type: "skills.skill.unregistered",
        payload: { id: skillId },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { removed: true };
    },
    async listSkills(): Promise<SkillDefinition[]> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return [];
      }
      operationsSucceeded += 1;
      return [...skills.values()].map((entry) => entry.definition);
    },
    async executeSkill(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return {
          ok: false,
          error: {
            code: "SERVICE_NOT_STARTED",
            message: notStarted
          }
        };
      }
      const skillEntry = skills.get(request.skillId);
      if (!skillEntry) {
        operationsFailed += 1;
        lastErrorCode = "SKILL_NOT_FOUND";
        return {
          ok: false,
          error: {
            code: "SKILL_NOT_FOUND",
            message: `skill not found: ${request.skillId}`
          }
        };
      }

      try {
        const output = await skillEntry.handler(request.args);
        await eventBus.publish({
          type: "skills.skill.executed",
          payload: { id: request.skillId },
          timestamp: new Date().toISOString()
        });
        operationsSucceeded += 1;
        return { ok: true, output };
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "SKILL_EXECUTION_FAILED";
        await logger.error("skill execution failed", {
          skillId: request.skillId,
          error: toErrorMessage(error)
        });
        return {
          ok: false,
          error: {
            code: "SKILL_EXECUTION_FAILED",
            message: "skill handler execution failed"
          }
        };
      }
    }
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
