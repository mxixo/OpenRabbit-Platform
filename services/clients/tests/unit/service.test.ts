import { describe, expect, it } from "vitest";
import { createClientsService } from "../../src/service.js";

describe("clients service scaffold", () => {
  it("manages lifecycle and descriptor", async () => {
    const service = createClientsService();
    expect(service.getDescriptor().serviceName).toBe("clients");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });

  it("registers and lists clients", async () => {
    const service = createClientsService();
    await service.start();
    await expect(
      service.registerClient(
        {
          clientId: "client.web.primary",
          channel: "web",
          version: "1.0.0",
          displayName: "Primary Web Client"
        },
        async (request) => ({ receivedAction: request.action })
      )
    ).resolves.toEqual({ registered: true });

    await expect(service.listClients()).resolves.toMatchObject([
      {
        clientId: "client.web.primary",
        channel: "web",
        version: "1.0.0"
      }
    ]);
  });

  it("dispatches client requests and returns deterministic errors for unknown clients", async () => {
    const service = createClientsService();
    await service.start();
    await service.registerClient(
      {
        clientId: "client.mobile.app",
        channel: "mobile",
        version: "1.0.0",
        displayName: "Mobile App"
      },
      async (request) => ({ action: request.action, payload: request.payload ?? {} })
    );

    await expect(
      service.dispatchClientRequest({
        clientId: "client.mobile.app",
        action: "sync-state",
        payload: { leadId: "L-100" }
      })
    ).resolves.toEqual({
      ok: true,
      output: { action: "sync-state", payload: { leadId: "L-100" } }
    });
    await expect(
      service.dispatchClientRequest({
        clientId: "client.unknown",
        action: "sync-state"
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "CLIENT_NOT_FOUND",
        message: "client not found: client.unknown"
      }
    });
  });
});
