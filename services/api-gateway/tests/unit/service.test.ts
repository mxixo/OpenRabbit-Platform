import { describe, expect, it } from "vitest";
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
});
