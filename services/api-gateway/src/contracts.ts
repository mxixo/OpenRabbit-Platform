export interface ServiceDescriptor {
  serviceName: "api-gateway";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface ApiRequestEnvelope {
  requestId: string;
  path: string;
  method: string;
  body?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ApiGatewayService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  validateRequest(input: unknown): ValidationResult;
}
