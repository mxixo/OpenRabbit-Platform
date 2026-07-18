import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  McpRequestInput,
  McpRequestOutput,
  OrchestratorService,
  ServiceDescriptor,
  ServiceHealth,
  ServiceStartupContext,
  TaskIntakeRequest,
  TaskIntakeResult
} from "./contracts.js";
export function createOrchestratorService(
  version = "0.1.0",
  startupContext: ServiceStartupContext = {}
): OrchestratorService {
  const config =
    startupContext.config ??
    new InMemoryConfigurationManager({
      defaults: {
        serviceName: "orchestrator"
      }
    });
  const eventBus = startupContext.eventBus ?? new InMemoryEventBus();
  const logger = (
    startupContext.logger ?? new StructuredLogger([new InMemoryLogSink()])
  ).child({
    service: "orchestrator"
  });

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;
  const processedTaskIds = new Set<string>();
  let registeredMcpServer:
    | { handleRequest(request: McpRequestInput): Promise<McpRequestOutput> }
    | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "orchestrator",
    version,
    capabilities: ["task-intake", "event-emission", "mcp-routing", "idempotency"]
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
    getReliabilitySnapshot(): ServiceReliabilitySnapshot {
      return {
        operationsSucceeded,
        operationsFailed,
        lastErrorCode
      };
    },
    async intakeTask(input: TaskIntakeRequest): Promise<TaskIntakeResult> {
      if (!started) {
        operationsFailed += 1;
        lastErrorCode = "SERVICE_NOT_STARTED";
        return { accepted: false, reason: "service not started" };
      }
      if (!input.taskId || !input.taskType) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_TASK_REQUEST";
        return { accepted: false, reason: "taskId and taskType are required" };
      }
      if (processedTaskIds.has(input.taskId)) {
        operationsSucceeded += 1;
        return { accepted: true, duplicate: true, reason: "duplicate task ignored" };
      }
      await eventBus.publish({
        type: "orchestrator.task.intake",
        payload: input,
        timestamp: new Date().toISOString()
      });
      processedTaskIds.add(input.taskId);
      operationsSucceeded += 1;
      return { accepted: true };
    },
    registerMcpServer(server: {
      handleRequest(request: McpRequestInput): Promise<McpRequestOutput>;
    }): void {
      registeredMcpServer = server;
    },
    async routeMcpRequest(input: McpRequestInput): Promise<McpRequestOutput> {
      if (!started) {
        operationsFailed += 1;
        lastErrorCode = "SERVICE_NOT_STARTED";
        return {
          id: input.id,
          error: {
            code: "SERVICE_NOT_STARTED",
            message: "orchestrator service not started"
          }
        };
      }
      if (!registeredMcpServer) {
        operationsFailed += 1;
        lastErrorCode = "MCP_SERVER_NOT_REGISTERED";
        return {
          id: input.id,
          error: {
            code: "MCP_SERVER_NOT_REGISTERED",
            message: "no MCP server registered"
          }
        };
      }
      await eventBus.publish({
        type: "orchestrator.mcp.dispatch",
        payload: input,
        timestamp: new Date().toISOString()
      });
      const output = await registeredMcpServer.handleRequest(input);
      if (output.error) {
        operationsFailed += 1;
        lastErrorCode = output.error.code;
      } else {
        operationsSucceeded += 1;
      }
      return output;
    }
  };
}