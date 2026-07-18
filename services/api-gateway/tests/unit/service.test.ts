import { describe, expect, it } from "vitest";
import { InMemoryConfigurationManager } from "../../../../packages/runtime-core/src/index.js";
import { createApiGatewayService } from "../../src/service.js";

describe("api-gateway service infrastructure", () => {
  it("exposes stable descriptor and lifecycle", async () => {
    const service = createApiGatewayService();
    expect(service.getDescriptor().serviceName).toBe("api-gateway");
    expect(service.isStarted()).toBe(false);
    await service.start();
    expect(service.isStarted()).toBe(true);
    expect(service.getHealth().status).toBe("ok");
    await service.stop();
    expect(service.getHealth().status).toBe("degraded");
  });

  it("validates request envelopes", () => {
    const service = createApiGatewayService();
    expect(
      service.validateRequest({
        requestId: "r1",
        path: "/health",
        method: "GET"
      }).valid
    ).toBe(true);
    expect(service.validateRequest({ method: "TRACE" }).valid).toBe(false);
  });

  it("handles requests with reliability tracking", async () => {
    const service = createApiGatewayService();
    expect((await service.handleRequest({})).ok).toBe(false);
    await service.start();
    const result = await service.handleRequest({
      requestId: "r2",
      path: "/status",
      method: "GET"
    });
    expect(result.ok).toBe(true);
    expect(service.getReliabilitySnapshot().operationsSucceeded).toBe(1);
    expect(service.getReliabilitySnapshot().operationsFailed).toBe(1);
  });

  it("supports startup context dependency overrides", async () => {
    const service = createApiGatewayService("0.1.0", {
      config: new InMemoryConfigurationManager({
        defaults: {
          serviceName: "api-gateway",
          region: "local-test"
        }
      })
    });
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });
});
