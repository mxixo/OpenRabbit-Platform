import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveEnvironmentBlueprint,
  sealEnvironmentBlueprintRevision,
  type ApprovalRequest,
  type AuditRecord,
  type WorkerTaskResult,
} from "@openrabbit/runtime-core";
import type { PlatformApiBackend } from "../../src/platform-api.js";
import { createSupabaseEnvironmentBackend } from "../../src/supabase-environment-backend.js";

const PROJECT_REF = "abcdefghijklmnopqrst";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function baseBackend(): PlatformApiBackend {
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
        completedAt: "2026-09-23T10:00:00.000Z",
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
    },
  };
}

function revisionRow(orgId = "org-a") {
  const blueprint = resolveEnvironmentBlueprint({
    orgId,
    revision: "rev-1",
    generatedAt: "2026-09-23T10:00:00.000Z",
    capabilities: [
      {
        orgId,
        id: "calendar",
        version: "1.0.0",
        enabled: true,
        surfaces: ["calendar"],
      },
    ],
  });
  const sealed = sealEnvironmentBlueprintRevision(blueprint);
  return {
    protocol: sealed.protocol,
    org_id: sealed.orgId,
    revision: sealed.revision,
    generated_at: "2026-09-23T10:00:00+00:00",
    blueprint: sealed.blueprint,
    previous_record_hash: null,
    record_hash: sealed.recordHash,
  };
}

describe("Supabase Environment Blueprint backend", () => {
  it("reads only the latest org-scoped revision and verifies its hash chain record", async () => {
    let requestedUrl = "";
    let requestedHeaders: unknown;
    const backend = createSupabaseEnvironmentBackend({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      baseBackend: baseBackend(),
      fetchImpl: async (input, init) => {
        requestedUrl = String(input);
        requestedHeaders = init?.headers;
        return new globalThis.Response(JSON.stringify([revisionRow()]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const loaded = await backend.getEnvironmentBlueprint?.("org-a");
    expect(loaded?.orgId).toBe("org-a");
    expect(loaded?.revision).toBe("rev-1");

    const url = new URL(requestedUrl);
    expect(url.origin).toBe(SUPABASE_URL);
    expect(url.pathname).toBe("/rest/v1/environment_blueprint_revisions");
    expect(url.searchParams.get("org_id")).toBe("eq.org-a");
    expect(url.searchParams.get("order")).toBe("append_seq.desc");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(JSON.stringify(requestedHeaders)).toContain("server-secret");
    expect(requestedUrl).not.toContain("server-secret");
  });

  it("fails closed when the Supabase URL does not match the designated project ref", () => {
    expect(() =>
      createSupabaseEnvironmentBackend({
        supabaseUrl: "https://zyxwvutsrqponmlkjihg.supabase.co",
        projectRef: PROJECT_REF,
        serviceRoleKey: "server-secret",
        baseBackend: baseBackend(),
      }),
    ).toThrow("does not match the explicitly designated projectRef");
  });

  it("returns undefined when the org has no persisted Environment Blueprint", async () => {
    const backend = createSupabaseEnvironmentBackend({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      baseBackend: baseBackend(),
      fetchImpl: async () =>
        new globalThis.Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });

    await expect(backend.getEnvironmentBlueprint?.("org-missing")).resolves.toBeUndefined();
  });

  it("rejects cross-org rows and cryptographic record drift", async () => {
    const crossOrg = createSupabaseEnvironmentBackend({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      baseBackend: baseBackend(),
      fetchImpl: async () =>
        new globalThis.Response(JSON.stringify([revisionRow("org-b")]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    await expect(crossOrg.getEnvironmentBlueprint?.("org-a")).rejects.toThrow(
      "different organization",
    );

    const tampered = revisionRow();
    tampered.blueprint.revision = "rev-tampered";
    const drifted = createSupabaseEnvironmentBackend({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      baseBackend: baseBackend(),
      fetchImpl: async () =>
        new globalThis.Response(JSON.stringify([tampered]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    await expect(drifted.getEnvironmentBlueprint?.("org-a")).rejects.toThrow(
      "identity disagrees",
    );
  });

  it("does not include provider response bodies or secrets in HTTP failure errors", async () => {
    const backend = createSupabaseEnvironmentBackend({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      baseBackend: baseBackend(),
      fetchImpl: async () =>
        new globalThis.Response('{"message":"sensitive provider detail"}', {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    });

    await expect(backend.getEnvironmentBlueprint?.("org-a")).rejects.toThrow(
      "Supabase environment read failed with status 401",
    );
  });
});
