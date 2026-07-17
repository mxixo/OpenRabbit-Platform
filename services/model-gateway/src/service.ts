import {
  InMemoryConfigurationManager,
  InMemoryLogSink,
  MockModelProvider,
  ServiceOperationResult,
  ServiceReliabilitySnapshot,
  StructuredLogger,
  withRetry
} from "../../../packages/runtime-core/src/index.js";
import {
  ModelGatewayService,
  ModelInvocationInput,
  ModelInvocationOutput,
  ServiceDescriptor,
  ServiceHealth
} from "./contracts.js";

export function createModelGatewayService(version = "0.1.0"): ModelGatewayService {
  const config = new InMemoryConfigurationManager({
    defaults: {
      serviceName: "model-gateway",
      defaultModel: "mock-default"
    }
  });
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({
    service: "model-gateway"
  });
  const provider = new MockModelProvider("core-services-mock-provider");
  provider.registerModel("mock-default", async (request) => ({
    model: request.model,
    output: `mock-response:${request.input}`
  }));

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;

  const descriptor: ServiceDescriptor = {
    serviceName: "model-gateway",
    version,
    capabilities: ["model-routing", "mock-provider-bridge", "safe-invoke"]
  };

  return {
    async start(): Promise<void> {
      started = true;
      await logger.info("model-gateway started");
    },
    async stop(): Promise<void> {
      started = false;
      await logger.info("model-gateway stopped");
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
          { name: "model-provider", status: "up" }
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
    async invokeModel(input: ModelInvocationInput): Promise<ModelInvocationOutput> {
      const result = await this.invokeModelSafe(input);
      if (!result.ok) {
        throw new Error(result.error?.message ?? "model invocation failed");
      }
      return result.data as ModelInvocationOutput;
    },
    async invokeModelSafe(
      input: ModelInvocationInput
    ): Promise<ServiceOperationResult<ModelInvocationOutput>> {
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
      if (!input.input?.trim()) {
        operationsFailed += 1;
        lastErrorCode = "INVALID_INPUT";
        return {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: "input is required",
            retryable: false
          }
        };
      }

      try {
        const model = input.model ?? config.get<string>("defaultModel");
        const result = await withRetry(
          async () =>
            provider.invoke({
              model,
              input: input.input
            }),
          { maxAttempts: 2 }
        );
        operationsSucceeded += 1;
        return {
          ok: true,
          data: {
            model: result.model,
            output: result.output
          }
        };
      } catch (error) {
        operationsFailed += 1;
        lastErrorCode = "MODEL_INVOCATION_FAILED";
        return {
          ok: false,
          error: {
            code: "MODEL_INVOCATION_FAILED",
            message: error instanceof Error ? error.message : String(error),
            retryable: true
          }
        };
      }
    }
  };
}