import { describe, expect, it } from "vitest";
import type {
  ApprovalRequest,
  AuditRecord,
  EnvironmentBlueprint,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import {
  routeEnvironmentBlueprintApi,
  type EnvironmentBlueprintApiBackend
} from "../../src/environment-api.js";
import { createApiGatewayService } from "../../src/service.js";

function blueprint(orgId = "org-1"): EnvironmentBlueprint {
  return {
    protocol: "environment_blueprint_v1",
    orgId,
    revision: "rev-42",
    generatedAt: "2026-09-23T05:00:00.000Z",
    packs: [{ id: "real-estate", version: "1.0.0", state: "enabled" }],
    capabilities: [
      {
        id: "calendar",
        version: "1.0.0",
        state: "enabled",
        surfaces: ["calendar"]
      }
    ],
    integrations: [{ id: "google-calendar", state: "available" }],
    workers: [],
    workflows: [],
    surfaces: [
      {
        id: "calendar",
        enabled: true,
        capabilityIds: ["calendar"],
        integrationIds: ["google-calendar"],
        workflowIds: []
      },
      { id: "communications", enabled: false, capabilityIds: [], integrationIds: [], workflowIds: [] },
      { id: "work", enabled: false, capabilityIds: [], integrationIds: [], workflowIds: [] },
      { id: "intelligence", enabled: false, capabilityIds: [], integrationIds: [], workflowIds: [] },
      { id: "social", enabled: false, capabilityIds: [], integrationIds: [], workflowIds: [] }
    ]
  };
}

function baseBackend(): EnvironmentBlueprintApiBackend {
  return {
    async installRealEstatePack() {
      return { packId: "pack.real-estate", workerIds: [] };
    },
    async listWorkers() {
      return [];
    },
    async submitWorkerTask(input) {
      return {
        workerId: input.workerId,
        taskId: input.taskId,
        status: "completed",
        completedAt: "2026-09-23T05:00:00.000Z"
      } satisfies WorkerTaskResult;
    },
    async getTaskResult() {
      return undefined;
    },
    async listApprovals() {
      return [] as ApprovalRequest[];
    },
    async listAudit() {
      return [] as AuditRecord[];
    },
    async decideApproval() {
      throw new Error("not used");
    }
  };
}

describe("environment blueprint Platform API", () => {
  it("returns the canonical environment projection read-only", async () => {
    const expected = blueprint();
    const backend: EnvironmentBlueprintApiBackend = {
      ...baseBackend(),
      async getEnvironmentBlueprint(orgId) {
        expect(orgId).toBe("org-1");
        return expected;
      }
    };

    const result = await routeEnvironmentBlueprintApi(
      { requestId: "environment-1", method: "GET", path: "/v1/orgs/org-1/environment" },
      backend
    );

    expect(result).toEqual({ matched: true, status: 200, data: expected });
  });

  it("fails explicitly when durable environment state is not composed", async () => {
    const result = await routeEnvironmentBlueprintApi(
      { requestId: "environment-2", method: "GET", path: "/v1/orgs/org-1/environment" },
      baseBackend()
    );

    expect(result).toMatchObject({
      matched: true,
      status: 501,
      error: { code: "ENVIRONMENT_BACKEND_NOT_AVAILABLE" }
    });
  });

  it("does not leak a blueprint returned for another org", async () => {
    const backend: EnvironmentBlueprintApiBackend = {
      ...baseBackend(),
      async getEnvironmentBlueprint() {
        return blueprint("org-other");
      }
    };

    const result = await routeEnvironmentBlueprintApi(
      { requestId: "environment-3", method: "GET", path: "/v1/orgs/org-1/environment" },
      backend
    );

    expect(result).toMatchObject({
      matched: true,
      status: 500,
      error: { code: "ENVIRONMENT_BLUEPRINT_ORG_MISMATCH" }
    });
  });

  it("is routed through the running API gateway", async () => {
    const expected = blueprint();
    const backend: EnvironmentBlueprintApiBackend = {
      ...baseBackend(),
      async getEnvironmentBlueprint() {
        return expected;
      }
    };
    const service = createApiGatewayService();
    service.registerPlatformBackend(backend);
    await service.start();

    const result = await service.handleRequest({
      requestId: "environment-4",
      method: "GET",
      path: "/v1/orgs/org-1/environment"
    });

    expect(result).toMatchObject({
      ok: true,
      data: { status: 200, result: expected }
    });
  });
});
