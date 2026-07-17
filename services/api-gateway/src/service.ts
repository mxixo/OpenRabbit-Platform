import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  InMemoryPermissionManager,
  ServiceOperationResult,
  ServiceReliabilitySnapshot,
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

  permissionManager.addPolicy({
    id: "allow-api-requests",
    effect: "allow",
    actions: ["read", "write"],
    resources: ["api-request"]
  });

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "api-gateway",
    version,
    capabilities: ["health", "request-validation", "request-handling"]
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
    getReliabilitySnapshot(): ServiceReliabilitySnapshot {
      return {
        operationsSucceeded,
        operationsFailed,
        lastErrorCode
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
    },
    async handleRequest(input: unknown): Promise<ServiceOperationResult<{ accepted: boolean }>> {
      if (!started) {
        operationsFailed += 1;
        lastErrorCode = "SERVICE_NOT_STARTED";
        return {
          ok: false,
          error: {
            code: "SERVICE_NOT_STARTED",
            message: "api-gateway service not started",
            retryable: true
          }
        };
      }
      const validation = this.validateRequest(input);
      if (!validation.valid) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_REQUEST";
        return {
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: validation.errors.join("; "),
            retryable: false
          }
        };
      }

      const request = input as ApiRequestEnvelope;
      const action = request.method.toUpperCase() === "GET" ? "read" : "write";
      const decision = permissionManager.evaluate({
        subject: {
          id: request.actorId ?? "anonymous",
          roles: request.actorRoles
        },
        action,
        resource: {
          type: "api-request"
        }
      });

      if (!decision.allowed) {
        operationsFailed += 1;
        lastErrorCode = "PERMISSION_DENIED";
        return {
          ok: false,
          error: {
            code: "PERMISSION_DENIED",
            message: decision.reason,
            retryable: false
          }
        };
      }

      await eventBus.publish({
        type: "api.request.accepted",
        payload: { requestId: request.requestId, path: request.path },
        timestamp: new Date().toISOString()
      });
      operationsSucceeded += 1;
      return {
        ok: true,
        data: { accepted: true }
      };
    }
  };
}