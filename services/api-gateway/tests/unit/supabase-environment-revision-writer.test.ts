import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveEnvironmentBlueprint,
  sealEnvironmentBlueprintRevision,
  type EnvironmentBlueprintRevisionRecord,
} from "@openrabbit/runtime-core";
import { createSupabaseEnvironmentRevisionWriter } from "../../src/supabase-environment-backend.js";

const PROJECT_REF = "abcdefghijklmnopqrst";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function blueprint(revision: string, generatedAt: string) {
  return resolveEnvironmentBlueprint({
    orgId: "org-a",
    revision,
    generatedAt,
    capabilities: [
      {
        orgId: "org-a",
        id: "calendar",
        version: "1.0.0",
        enabled: true,
        surfaces: ["calendar"],
      },
    ],
  });
}

function revisionRow(record: EnvironmentBlueprintRevisionRecord) {
  return {
    protocol: record.protocol,
    org_id: record.orgId,
    revision: record.revision,
    generated_at: record.generatedAt,
    blueprint: record.blueprint,
    previous_record_hash: record.previousRecordHash ?? null,
    record_hash: record.recordHash,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new globalThis.Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Supabase Environment Blueprint revision writer", () => {
  it("appends the first sealed revision after verifying no predecessor exists", async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const writer = createSupabaseEnvironmentRevisionWriter({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (input, init) => {
        const method = init?.method ?? "GET";
        const entry: { url: string; method: string; body?: string } = {
          url: String(input),
          method,
        };
        if (typeof init?.body === "string") entry.body = init.body;
        requests.push(entry);
        if (method === "GET") return jsonResponse([]);
        if (method !== "POST" || typeof init?.body !== "string") {
          throw new Error("unexpected test request");
        }
        const row: unknown = JSON.parse(init.body);
        return jsonResponse([row]);
      },
    });

    const persisted = await writer.appendEnvironmentBlueprint(
      blueprint("rev-1", "2026-09-23T11:00:00.000Z"),
    );

    expect(requests).toHaveLength(2);
    expect(requests[0]?.method).toBe("GET");
    const readUrl = new URL(requests[0]?.url ?? "");
    expect(readUrl.searchParams.get("org_id")).toBe("eq.org-a");
    expect(readUrl.searchParams.get("order")).toBe("append_seq.desc");
    expect(requests[1]?.method).toBe("POST");
    const posted = JSON.parse(requests[1]?.body ?? "{}") as Record<string, unknown>;
    expect(posted.previous_record_hash).toBeNull();
    expect(posted.record_hash).toBe(persisted.recordHash);
    expect(persisted.previousRecordHash).toBeUndefined();
    expect(requests[0]?.url).not.toContain("server-secret");
    expect(requests[1]?.url).not.toContain("server-secret");
  });

  it("links a new revision to the exact verified latest predecessor", async () => {
    const first = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T11:00:00.000Z"),
    );
    let postedBody: string | undefined;
    const writer = createSupabaseEnvironmentRevisionWriter({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (_input, init) => {
        if ((init?.method ?? "GET") === "GET") return jsonResponse([revisionRow(first)]);
        if (typeof init?.body !== "string") throw new Error("expected JSON body");
        postedBody = init.body;
        const row: unknown = JSON.parse(init.body);
        return jsonResponse([row]);
      },
    });

    const persisted = await writer.appendEnvironmentBlueprint(
      blueprint("rev-2", "2026-09-23T11:01:00.000Z"),
    );

    const posted = JSON.parse(postedBody ?? "{}") as Record<string, unknown>;
    expect(posted.previous_record_hash).toBe(first.recordHash);
    expect(persisted.previousRecordHash).toBe(first.recordHash);
    expect(persisted.recordHash).not.toBe(first.recordHash);
  });

  it("fails before POST for duplicate or backward revisions", async () => {
    const first = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T11:00:00.000Z"),
    );
    let postCount = 0;
    const writer = createSupabaseEnvironmentRevisionWriter({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (_input, init) => {
        if ((init?.method ?? "GET") === "POST") {
          postCount += 1;
          throw new Error("POST should not run");
        }
        return jsonResponse([revisionRow(first)]);
      },
    });

    await expect(
      writer.appendEnvironmentBlueprint(blueprint("rev-1", "2026-09-23T11:00:01.000Z")),
    ).rejects.toThrow("revision already exists");
    await expect(
      writer.appendEnvironmentBlueprint(blueprint("rev-2", "2026-09-23T10:59:59.000Z")),
    ).rejects.toThrow("generatedAt cannot move backward");
    expect(postCount).toBe(0);
  });

  it("rejects a provider response that substitutes another valid revision", async () => {
    const substituted = sealEnvironmentBlueprintRevision(
      blueprint("rev-substituted", "2026-09-23T11:00:00.000Z"),
    );
    const writer = createSupabaseEnvironmentRevisionWriter({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (_input, init) => {
        if ((init?.method ?? "GET") === "GET") return jsonResponse([]);
        return jsonResponse([revisionRow(substituted)]);
      },
    });

    await expect(
      writer.appendEnvironmentBlueprint(blueprint("rev-1", "2026-09-23T11:00:00.000Z")),
    ).rejects.toThrow("different revision record");
  });

  it("sanitizes provider write failures and does not surface response bodies or secrets", async () => {
    const writer = createSupabaseEnvironmentRevisionWriter({
      supabaseUrl: SUPABASE_URL,
      projectRef: PROJECT_REF,
      serviceRoleKey: "server-secret",
      fetchImpl: async (_input, init) => {
        if ((init?.method ?? "GET") === "GET") return jsonResponse([]);
        return new globalThis.Response(
          '{"message":"sensitive provider detail server-secret"}',
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    let observed = "";
    try {
      await writer.appendEnvironmentBlueprint(
        blueprint("rev-1", "2026-09-23T11:00:00.000Z"),
      );
    } catch (error) {
      observed = error instanceof Error ? error.message : String(error);
    }
    expect(observed).toBe("Supabase environment append failed with status 409");
    expect(observed).not.toContain("sensitive provider detail");
    expect(observed).not.toContain("server-secret");
  });

  it("fails closed when writer URL does not match the designated project ref", () => {
    expect(() =>
      createSupabaseEnvironmentRevisionWriter({
        supabaseUrl: "https://zyxwvutsrqponmlkjihg.supabase.co",
        projectRef: PROJECT_REF,
        serviceRoleKey: "server-secret",
      }),
    ).toThrow("does not match the explicitly designated projectRef");
  });
});
