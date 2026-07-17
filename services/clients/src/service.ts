import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  ClientDescriptor,
  ClientRequest,
  ClientResponse,
  ClientRuntimeHandler,
  ClientsService,
  ServiceDescriptor,
  ServiceHealth
} from "./contracts.js";

export function createClientsService(version = "0.1.0"): ClientsService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "clients"
    }
  });
  const eventBus = new InMemoryEventBus();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "clients"
  });

  const clients = new Map<string, { descriptor: ClientDescriptor; handler: ClientRuntimeHandler }>();
  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "clients",
    version,
    capabilities: ["client-registration", "client-list", "client-dispatch", "client-removal"]
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
      await logger.info("clients service started", { configKeys: config.keys() });
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("clients service stopped");
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
          { name: "client-registry", status: "up" }
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
    async registerClient(
      client: ClientDescriptor,
      handler: ClientRuntimeHandler
    ): Promise<{ registered: boolean; reason?: string }> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return { registered: false, reason: notStarted };
      }
      if (!client.clientId || !client.version || !client.displayName) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_CLIENT_DESCRIPTOR";
        return { registered: false, reason: "clientId, version, and displayName are required" };
      }
      if (clients.has(client.clientId)) {
        operationsFailed += 1;
        lastErrorCode = "CLIENT_ALREADY_REGISTERED";
        return { registered: false, reason: "client already registered" };
      }

      clients.set(client.clientId, { descriptor: client, handler });
      await eventBus.publish({
        type: "clients.client.registered",
        payload: { clientId: client.clientId, channel: client.channel },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { registered: true };
    },
    async unregisterClient(clientId: string): Promise<{ removed: boolean; reason?: string }> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return { removed: false, reason: notStarted };
      }
      const removed = clients.delete(clientId);
      if (!removed) {
        operationsFailed += 1;
        lastErrorCode = "CLIENT_NOT_FOUND";
        return { removed: false, reason: "client not found" };
      }
      await eventBus.publish({
        type: "clients.client.unregistered",
        payload: { clientId },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return { removed: true };
    },
    async listClients(): Promise<ClientDescriptor[]> {
      const notStarted = ensureStarted();
      if (notStarted) {
        return [];
      }
      operationsSucceeded += 1;
      return [...clients.values()].map((entry) => entry.descriptor);
    },
    async dispatchClientRequest(request: ClientRequest): Promise<ClientResponse> {
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
      const client = clients.get(request.clientId);
      if (!client) {
        operationsFailed += 1;
        lastErrorCode = "CLIENT_NOT_FOUND";
        return {
          ok: false,
          error: {
            code: "CLIENT_NOT_FOUND",
            message: `client not found: ${request.clientId}`
          }
        };
      }

      try {
        const output = await client.handler(request);
        await eventBus.publish({
          type: "clients.client.request.dispatched",
          payload: { clientId: request.clientId, action: request.action },
          timestamp: new Date().toISOString()
        });
        operationsSucceeded += 1;
        return { ok: true, output };
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "CLIENT_REQUEST_FAILED";
        await logger.error("client request handler failed", {
          clientId: request.clientId,
          action: request.action,
          error: toErrorMessage(error)
        });
        return {
          ok: false,
          error: {
            code: "CLIENT_REQUEST_FAILED",
            message: "client request handler failed"
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
