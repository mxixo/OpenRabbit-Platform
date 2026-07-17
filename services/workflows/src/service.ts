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
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
  WorkflowRuntimeHandler,
  WorkflowTemplate,
  WorkflowsService
} from "./contracts.js";

export function createWorkflowsService(version = "0.1.0"): WorkflowsService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "workflows"
    }
  });
  const eventBus = new InMemoryEventBus();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "workflows"
  });

  const workflows = new Map<string, { template: WorkflowTemplate; handler: WorkflowRuntimeHandler }>();
  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "workflows",
    version,
    capabilities: ["workflow-registration", "workflow-list", "workflow-run", "workflow-removal"]
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
      await logger.info("workflows service started", { configKeys: config.keys() });
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("workflows service stopped");
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
          { name: "workflow-registry", status: "up" }
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
    async registerWorkflow(
      template: WorkflowTemplate,
      handler: WorkflowRuntimeHandler
    ): Promise<{ registered: boolean; reason?: string }> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return { registered: false, reason: notStarted };
      }
      if (!template.id || !template.version || !template.name || template.stepIds.length === 0) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_WORKFLOW_TEMPLATE";
        return { registered: false, reason: "id, version, name, and at least one step are required" };
      }
      if (workflows.has(template.id)) {
        operationsFailed += 1;
        lastErrorCode = "WORKFLOW_ALREADY_REGISTERED";
        return { registered: false, reason: "workflow already registered" };
      }

      workflows.set(template.id, { template, handler });
      await eventBus.publish({
        type: "workflows.workflow.registered",
        payload: { id: template.id, version: template.version },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { registered: true };
    },
    async unregisterWorkflow(workflowId: string): Promise<{ removed: boolean; reason?: string }> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return { removed: false, reason: notStarted };
      }
      const removed = workflows.delete(workflowId);
      if (!removed) {
        operationsFailed += 1;
        lastErrorCode = "WORKFLOW_NOT_FOUND";
        return { removed: false, reason: "workflow not found" };
      }
      await eventBus.publish({
        type: "workflows.workflow.unregistered",
        payload: { id: workflowId },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { removed: true };
    },
    async listWorkflows(): Promise<WorkflowTemplate[]> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return [];
      }
      operationsSucceeded += 1;
      return [...workflows.values()].map((entry) => entry.template);
    },
    async runWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> {
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
      const workflow = workflows.get(request.workflowId);
      if (!workflow) {
        operationsFailed += 1;
        lastErrorCode = "WORKFLOW_NOT_FOUND";
        return {
          ok: false,
          error: {
            code: "WORKFLOW_NOT_FOUND",
            message: `workflow not found: ${request.workflowId}`
          }
        };
      }

      try {
        const output = await workflow.handler(request);
        await eventBus.publish({
          type: "workflows.workflow.executed",
          payload: { id: request.workflowId },
          timestamp: new Date().toISOString()
        });
        operationsSucceeded += 1;
        return { ok: true, output };
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "WORKFLOW_EXECUTION_FAILED";
        await logger.error("workflow execution failed", {
          workflowId: request.workflowId,
          error: toErrorMessage(error)
        });
        return {
          ok: false,
          error: {
            code: "WORKFLOW_EXECUTION_FAILED",
            message: "workflow handler execution failed"
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
