import {
  ServiceHealthReport,
  ServiceOperationResult,
  ServiceReliabilitySnapshot
} from "@openrabbit/runtime-core";
import type { PlatformApiBackend } from "./platform-api.js";
import type { DelegatedAuthorizationAdapter } from "./provider-connections.js";

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

export interface ApiResponseData {
  accepted?: boolean;
  status?: number;
  result?: unknown;
}

export interface ApiGatewayService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  validateRequest(input: unknown): ValidationResult;
  registerPlatformBackend(backend: PlatformApiBackend): void;
  registerProviderAuthorizationAdapter(adapter: DelegatedAuthorizationAdapter): void;
  handleRequest(input: unknown): Promise<ServiceOperationResult<ApiResponseData>>;
}
