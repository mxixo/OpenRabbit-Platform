import { describe, expect, it } from "vitest";
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
});
