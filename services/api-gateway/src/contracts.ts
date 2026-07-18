import {
  ConfigurationManager,
  EventBus,
  Logger,
  PermissionManager,
  ServiceHealthReport,
  ServiceOperationResult,
  ServiceReliabilitySnapshot
} from "../../../packages/runtime-core/src/index.js";

export interface ServiceDescriptor {
  serviceName: "api-gateway";
  version: string;
  capabilities: string[];
}

export type ServiceHealth = ServiceHealthReport;

export interface ApiRequestEnvelope {
  requestId: string;
  path: string;
  method: string;
  body?: unknown;
  actorId?: string;
  actorRoles?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
export interface ServiceStartupContext {
  config?: ConfigurationManager;
  eventBus?: EventBus;
  permissionManager?: PermissionManager;
  logger?: Logger;
}

export interface ApiGatewayService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  validateRequest(input: unknown): ValidationResult;
  handleRequest(input: unknown): Promise<ServiceOperationResult<{ accepted: boolean }>>;
}