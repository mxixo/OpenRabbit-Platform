import {
  InMemoryLogSink,
  InMemoryPermissionManager,
  ServiceOperationResult,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  PolicyCheckInput,
  PolicyCheckOutput,
  PolicyService,
  ServiceDescriptor,
  ServiceHealth,
  ServiceStartupContext
} from "./contracts.js";
export function createPolicyService(
  version = "0.1.0",
  startupContext: ServiceStartupContext = {}
): PolicyService {
  const permissionManager = startupContext.permissionManager ?? new InMemoryPermissionManager();
  const logger = (
    startupContext.logger ?? new StructuredLogger([new InMemoryLogSink()])
  ).child({
    service: "policy"
  });

  permissionManager.addPolicy({
    id: "allow-admin-all",
    effect: "allow",
    actions: ["*"],
    resources: ["*"],
    roles: ["admin"]
  });
  permissionManager.addPolicy({
    id: "allow-read-default",
    effect: "allow",
    actions: ["read"],
    resources: ["*"]
  });

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "policy",
    version,
    capabilities: ["policy-evaluation", "permission-adapter", "safe-evaluation"]
  };

  return {
    async start(): Promise<void> {
      started = true;
      await logger.info("policy service started");
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("policy service stopped");
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
        dependencies: [{ name: "permission-manager", status: "up" }]
      };
    },
    getReliabilitySnapshot(): ServiceReliabilitySnapshot {
      return {
        operationsSucceeded,
        operationsFailed,
        lastErrorCode
      };
    },
    evaluate(input: PolicyCheckInput): PolicyCheckOutput {
      const result = this.evaluateSafe(input);
      if (!result.ok) {
        return {
          allowed: false,
          reason: result.error?.message ?? "evaluation failed"
        };
      }
      return result.data as PolicyCheckOutput;
    },
    evaluateSafe(input: PolicyCheckInput): ServiceOperationResult<PolicyCheckOutput> {
      if (!started) {
        operationsFailed += 1;
        lastErrorCode = "SERVICE_NOT_STARTED";
        return {
          ok: false,
          error: {
            code: "SERVICE_NOT_STARTED",
            message: "service not started",
            retryable: true
          }
        };
      }
      if (!input.subjectId || !input.action || !input.resourceType) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_POLICY_REQUEST";
        return {
          ok: false,
          error: {
            code: "INVALID_POLICY_REQUEST",
            message: "subjectId, action, and resourceType are required",
            retryable: false
          }
        };
      }
      const decision = permissionManager.evaluate({
        subject: {
          id: input.subjectId,
          roles: input.roles
        },
        action: input.action,
        resource: { type: input.resourceType }
      });
      operationsSucceeded += 1;
      return {
        ok: true,
        data: {
          allowed: decision.allowed,
          reason: decision.reason
        }
      };
    }
  };
}