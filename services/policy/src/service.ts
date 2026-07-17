import {
  InMemoryLogSink,
  InMemoryPermissionManager,
  StructuredLogger
} from "../../../packages/runtime-core/src/index.js";
import {
  PolicyCheckInput,
  PolicyCheckOutput,
  PolicyService,
  ServiceDescriptor,
  ServiceHealth
} from "./contracts.js";

export function createPolicyService(version = "0.1.0"): PolicyService {
  const permissionManager = new InMemoryPermissionManager();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
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

  const descriptor: ServiceDescriptor = {
    serviceName: "policy",
    version,
    capabilities: ["policy-evaluation", "permission-adapter"]
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
    evaluate(input: PolicyCheckInput): PolicyCheckOutput {
      if (!started) {
        return { allowed: false, reason: "service not started" };
      }
      const decision = permissionManager.evaluate({
        subject: {
          id: input.subjectId,
          roles: input.roles
        },
        action: input.action,
        resource: { type: input.resourceType }
      });
      return {
        allowed: decision.allowed,
        reason: decision.reason
      };
    }
  };
}
