export interface ServiceDescriptor {
  serviceName: "policy";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface PolicyCheckInput {
  subjectId: string;
  roles?: string[];
  action: string;
  resourceType: string;
}

export interface PolicyCheckOutput {
  allowed: boolean;
  reason: string;
}

export interface PolicyService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  evaluate(input: PolicyCheckInput): PolicyCheckOutput;
}
