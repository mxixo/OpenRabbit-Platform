import {
  ConfigurationManager,
  Logger,
  ModelProvider,
  ServiceOperationResult,
  ServiceReliabilitySnapshot
} from "../../../packages/runtime-core/src/index.js";
export interface ServiceDescriptor {
  serviceName: "model-gateway";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface ModelInvocationInput {
  model?: string;
  input: string;
}

export interface ModelInvocationOutput {
  model: string;
  output: string;
}
export interface ServiceStartupContext {
  config?: ConfigurationManager;
  logger?: Logger;
  modelProvider?: ModelProvider;
}

export interface ModelGatewayService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  invokeModel(input: ModelInvocationInput): Promise<ModelInvocationOutput>;
  invokeModelSafe(input: ModelInvocationInput): Promise<ServiceOperationResult<ModelInvocationOutput>>;
}
