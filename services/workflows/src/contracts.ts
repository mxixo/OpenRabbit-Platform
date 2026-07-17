import { ServiceReliabilitySnapshot } from "../../../packages/runtime-core/src/index.js";

export interface ServiceDescriptor {
  serviceName: "workflows";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface WorkflowTemplate {
  id: string;
  version: string;
  name: string;
  description?: string;
  stepIds: string[];
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  variables?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export type WorkflowRuntimeHandler = (
  request: WorkflowExecutionRequest
) => unknown | Promise<unknown>;

export interface WorkflowsService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  registerWorkflow(
    template: WorkflowTemplate,
    handler: WorkflowRuntimeHandler
  ): Promise<{ registered: boolean; reason?: string }>;
  unregisterWorkflow(workflowId: string): Promise<{ removed: boolean; reason?: string }>;
  listWorkflows(): Promise<WorkflowTemplate[]>;
  runWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult>;
}
