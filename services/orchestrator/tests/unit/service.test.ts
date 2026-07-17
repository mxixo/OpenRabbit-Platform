import { describe, expect, it } from "vitest";
import { createOrchestratorService } from "../../src/service.js";

describe("orchestrator service infrastructure", () => {
  it("manages lifecycle and exposes descriptor", async () => {
    const service = createOrchestratorService();
    expect(service.getDescriptor().serviceName).toBe("orchestrator");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });

  it("accepts valid task intake only after startup", async () => {
    const service = createOrchestratorService();
    expect(
      await service.intakeTask({ taskId: "t1", taskType: "sync", payload: {} })
    ).toEqual({ accepted: false, reason: "service not started" });

    await service.start();
    expect(
      await service.intakeTask({ taskId: "t1", taskType: "sync", payload: {} })
    ).toEqual({ accepted: true });
  });

  it("routes MCP requests to registered MCP server", async () => {
    const service = createOrchestratorService();
    await service.start();
    service.registerMcpServer({
      async handleRequest(request) {
        return { id: request.id, result: { echoedMethod: request.method } };
      }
    });
    await expect(
      service.routeMcpRequest({ id: "m1", method: "tools/list" })
    ).resolves.toEqual({
      id: "m1",
      result: { echoedMethod: "tools/list" }
    });
  });
});
