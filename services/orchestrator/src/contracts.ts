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
}

export interface OrchestratorService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  intakeTask(input: TaskIntakeRequest): Promise<TaskIntakeResult>;
}
