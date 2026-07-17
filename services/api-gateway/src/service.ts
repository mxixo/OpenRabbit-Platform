import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  InMemoryPermissionManager,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  ApiGatewayService,
  ApiRequestEnvelope,
  ServiceDescriptor,
  ServiceHealth,
  ValidationResult
} from "./contracts.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function createApiGatewayService(version = "0.1.0"): ApiGatewayService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "api-gateway"
    }
  });
  const eventBus = new InMemoryEventBus();
  const permissionManager = new InMemoryPermissionManager();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "api-gateway"
  });

  let started = false;

  const descriptor: ServiceDescriptor = {
    serviceName: "api-gateway",
    version,
    capabilities: ["health", "request-validation"]
  };

  return {
    async start(): Promise<void> {
      started = true;
      await logger.info("api-gateway started", { configKeys: config.keys() });
      await eventBus.publish({
        type: "service.started",
        payload: { service: descriptor.serviceName },
        timestamp: new Date().toISOString()
      });
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("api-gateway stopped");
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
          { name: "permission-manager", status: "up" }
        ]
      };
    },
    validateRequest(input: unknown): ValidationResult {
      const errors: string[] = [];
      const request = input as Partial<ApiRequestEnvelope>;

      if (!request?.requestId || typeof request.requestId !== "string") {
        errors.push("requestId is required");
      }
      if (!request?.path || typeof request.path !== "string") {
        errors.push("path is required");
      }
      if (!request?.method || typeof request.method !== "string") {
        errors.push("method is required");
      } else if (!ALLOWED_METHODS.has(request.method.toUpperCase())) {
        errors.push("method is not supported");
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }
  };
}
