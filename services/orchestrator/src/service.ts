import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "@openrabbit/runtime-core";
import type {
  WorkerOrchestrator,
  WorkerTaskRequest,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import {
  McpRequestInput,
  McpRequestOutput,
  OrchestratorService,
  ServiceDescriptor,
  ServiceHealth,
  TaskIntakeRequest,
  TaskIntakeResult
} from "./contracts.js";

function failedWorkerTask(
  input: Partial<WorkerTaskRequest>,
  code: string,
  message: string,
  retryable = false
): WorkerTaskResult {
  return {
    workerId: input.workerId ?? "unknown-worker",
    taskId: input.taskId ?? "unknown-task",
    status: "failed",
    error: {
      code,
      message,
      retryable
    },
    completedAt: new Date().toISOString()
  };
}

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
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;
  const processedTaskIds = new Set<string>();
  const workerTaskResults = new Map<string, WorkerTaskResult>();
  let registeredWorkerOrchestrator: WorkerOrchestrator | undefined;
  let registeredMcpServer:
    | { handleRequest(request: McpRequestInput): Promise<McpRequestOutput> }
    | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "orchestrator",
    version,
    capabilities: [
      "task-intake",
      "worker-task-routing",
      "event-emission",
      "mcp-routing",
      "idempotency"
    ]
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
          { name: "event-bus", status: "up" },
          ...(registeredWorkerOrchestrator
            ? [{ name: "worker-orchestrator", status: "up" as const }]
            : [])
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
    registerWorkerOrchestrator(orchestrator: WorkerOrchestrator): void {
      registeredWorkerOrchestrator = orchestrator;
    },
    async runWorkerTask(input: WorkerTaskRequest): Promise<WorkerTaskResult> {
      if (!started) {
        operationsFailed += 1;
        lastErrorCode = "SERVICE_NOT_STARTED";
        return failedWorkerTask(
          input,
          "SERVICE_NOT_STARTED",
          "orchestrator service not started"
        );
      }
      if (!input.workerId || !input.taskId || !input.taskType) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_WORKER_TASK_REQUEST";
        return failedWorkerTask(
          input,
          "INVALID_WORKER_TASK_REQUEST",
          "workerId, taskId, and taskType are required"
        );
      }

      const taskKey = `${input.workerId}:${input.taskId}`;
      const cached = workerTaskResults.get(taskKey);
      if (cached) {
        operationsSucceeded += 1;
        return cached;
      }

      if (!registeredWorkerOrchestrator) {
        operationsFailed += 1;
        lastErrorCode = "WORKER_ORCHESTRATOR_NOT_REGISTERED";
        return failedWorkerTask(
          input,
          "WORKER_ORCHESTRATOR_NOT_REGISTERED",
          "no WorkerOrchestrator registered"
        );
      }

      await eventBus.publish({
        type: "orchestrator.worker.task.dispatch",
        payload: input,
        timestamp: new Date().toISOString()
      });

      try {
        const result = await registeredWorkerOrchestrator.runTask(input);
        if (["completed", "blocked", "cancelled"].includes(result.status)) {
          workerTaskResults.set(taskKey, result);
          operationsSucceeded += 1;
        } else {
          operationsFailed += 1;
          lastErrorCode = result.error?.code ?? "WORKER_TASK_FAILED";
        }

        await eventBus.publish({
          type: "orchestrator.worker.task.result",
          payload: result,
          timestamp: new Date().toISOString()
        });
        return result;
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "WORKER_ORCHESTRATOR_ERROR";
        return failedWorkerTask(
          input,
          "WORKER_ORCHESTRATOR_ERROR",
          error instanceof Error ? error.message : "worker orchestrator failed",
          true
        );
      }
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
