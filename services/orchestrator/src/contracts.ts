import type {
  ServiceReliabilitySnapshot,
  WorkerOrchestrator,
  WorkerTaskRequest,
  WorkerTaskResult
} from "@openrabbit/runtime-core";

export interface ServiceDescriptor {
  serviceName: "orchestrator";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface TaskIntakeRequest {
  taskId: string;
  taskType: string;
  payload: unknown;
}

export interface TaskIntakeResult {
  accepted: boolean;
  reason?: string;
  duplicate?: boolean;
}

export interface McpRequestInput {
  id?: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpRequestOutput {
  id?: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface OrchestratorService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  intakeTask(input: TaskIntakeRequest): Promise<TaskIntakeResult>;
  registerWorkerOrchestrator(orchestrator: WorkerOrchestrator): void;
  runWorkerTask(input: WorkerTaskRequest): Promise<WorkerTaskResult>;
  registerMcpServer(server: {
    handleRequest(request: McpRequestInput): Promise<McpRequestOutput>;
  }): void;
  routeMcpRequest(input: McpRequestInput): Promise<McpRequestOutput>;
}
