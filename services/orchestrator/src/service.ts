import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  OrchestratorService,
  ServiceDescriptor,
  ServiceHealth,
  TaskIntakeRequest,
  TaskIntakeResult
} from "./contracts.js";

export function createOrchestratorService(version = "0.1.0"): OrchestratorService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "orchestrator"
    }
  });
  const eventBus = new InMemoryEventBus();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "orchestrator"
  });

  let started = false;

  const descriptor: ServiceDescriptor = {
    serviceName: "orchestrator",
    version,
    capabilities: ["task-intake", "event-emission"]
  };

  return {
    async start(): Promise<void> {
      started = true;
      await logger.info("orchestrator started", { configKeys: config.keys() });
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("orchestrator stopped");
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
          { name: "event-bus", status: "up" }
        ]
      };
    },
    async intakeTask(input: TaskIntakeRequest): Promise<TaskIntakeResult> {
      if (!started) {
        return { accepted: false, reason: "service not started" };
      }
      if (!input.taskId || !input.taskType) {
        return { accepted: false, reason: "taskId and taskType are required" };
      }
      await eventBus.publish({
        type: "orchestrator.task.intake",
        payload: input,
        timestamp: new Date().toISOString()
      });
      return { accepted: true };
    }
  };
}
