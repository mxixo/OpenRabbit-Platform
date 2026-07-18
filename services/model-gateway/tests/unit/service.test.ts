import { describe, expect, it } from "vitest";
import { InMemoryConfigurationManager, MockModelProvider } from "../../../../packages/runtime-core/src/index.js";
import { createModelGatewayService } from "../../src/service.js";

describe("model-gateway service infrastructure", () => {
  it("exposes lifecycle and descriptor", async () => {
    const service = createModelGatewayService();
    expect(service.getDescriptor().serviceName).toBe("model-gateway");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });

  it("routes model calls through mock provider", async () => {
    const service = createModelGatewayService();
    await service.start();
    await expect(service.invokeModel({ input: "hello" })).resolves.toEqual({
      model: "mock-default",
      output: "mock-response:hello"
    });
    await expect(service.invokeModel({ input: "" })).rejects.toThrow("input is required");
  });

  it("provides safe invocation results and reliability counters", async () => {
    const service = createModelGatewayService();
    const preStart = await service.invokeModelSafe({ input: "hello" });
    expect(preStart.ok).toBe(false);
    await service.start();
    const ok = await service.invokeModelSafe({ input: "hello" });
    expect(ok.ok).toBe(true);
    const bad = await service.invokeModelSafe({ input: "" });
    expect(bad.ok).toBe(false);
    const snapshot = service.getReliabilitySnapshot();
    expect(snapshot.operationsSucceeded).toBe(1);
    expect(snapshot.operationsFailed).toBe(2);
  });

  it("supports startup context injection for provider and config", async () => {
    const provider = new MockModelProvider("injected-model-provider");
    provider.registerModel("injected-default", async (request) => ({
      model: request.model,
      output: `injected:${request.input}`
    }));
    const service = createModelGatewayService("0.1.0", {
      modelProvider: provider,
      config: new InMemoryConfigurationManager({
        defaults: {
          serviceName: "model-gateway",
          defaultModel: "injected-default"
        }
      })
    });
    await service.start();
    await expect(service.invokeModel({ input: "hello" })).resolves.toEqual({
      model: "injected-default",
      output: "injected:hello"
    });
  });
});
