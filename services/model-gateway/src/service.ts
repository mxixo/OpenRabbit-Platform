import {
  InMemoryConfigurationManager,
  InMemoryLogSink,
  MockModelProvider,
  StructuredLogger
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

  const descriptor: ServiceDescriptor = {
    serviceName: "model-gateway",
    version,
    capabilities: ["model-routing", "mock-provider-bridge"]
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
    async invokeModel(input: ModelInvocationInput): Promise<ModelInvocationOutput> {
      if (!started) {
        throw new Error("service not started");
      }
      if (!input.input?.trim()) {
        throw new Error("input is required");
      }
      const model = input.model ?? config.get<string>("defaultModel");
      const result = await provider.invoke({
        model,
        input: input.input
      });
      return {
        model: result.model,
        output: result.output
      };
    }
  };
}
