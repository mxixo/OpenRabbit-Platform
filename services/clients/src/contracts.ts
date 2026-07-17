import { ServiceReliabilitySnapshot } from "../../../packages/runtime-core/src/index.js";

export type ClientChannel = "web" | "mobile" | "desktop";

export interface ServiceDescriptor {
  serviceName: "clients";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface ClientDescriptor {
  clientId: string;
  channel: ClientChannel;
  version: string;
  displayName: string;
  capabilities?: string[];
}

export interface ClientRequest {
  clientId: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface ClientResponse {
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export type ClientRuntimeHandler = (
  request: ClientRequest
) => unknown | Promise<unknown>;

export interface ClientsService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  registerClient(
    descriptor: ClientDescriptor,
    handler: ClientRuntimeHandler
  ): Promise<{ registered: boolean; reason?: string }>;
  unregisterClient(clientId: string): Promise<{ removed: boolean; reason?: string }>;
  listClients(): Promise<ClientDescriptor[]>;
  dispatchClientRequest(request: ClientRequest): Promise<ClientResponse>;
}
