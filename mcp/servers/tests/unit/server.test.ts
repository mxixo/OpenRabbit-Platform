import { describe, expect, it } from "vitest";
import { createInMemoryMcpServer } from "../../src/index.js";

describe("in-memory mcp server", () => {
  it("registers and dispatches tools/resources", async () => {
    const server = createInMemoryMcpServer("test-server");
    server.registerTool({ name: "echo", description: "echo" }, async (args) => args);
    server.registerResource({ uri: "memo://a", name: "memo" }, async () => "content");
    await expect(server.callTool("echo", { ok: true })).resolves.toEqual({
      ok: true,
      output: { ok: true }
    });
    await expect(server.readResource("memo://a")).resolves.toEqual({
      ok: true,
      resource: { uri: "memo://a", content: "content" }
    });
  });

  it("maps unknown methods deterministically", async () => {
    const server = createInMemoryMcpServer("test-server");
    const result = await server.handleRequest({ method: "unknown/method" });
    expect(result.error?.code).toBe("METHOD_NOT_SUPPORTED");
  });

  it("negotiates protocol during initialize", async () => {
    const server = createInMemoryMcpServer("test-server", "1.2.3");
    const result = await server.handleRequest({
      id: "init-1",
      method: "initialize",
      params: { protocolVersion: "2026-07-17", clientName: "tester" }
    });
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual({
      serverName: "test-server",
      version: "1.2.3",
      protocolVersion: "2026-07-17",
      supportedProtocolVersions: ["2026-07-17"],
      capabilities: ["tools", "resources", "requests"]
    });
  });

  it("returns deterministic compatibility and params errors", async () => {
    const server = createInMemoryMcpServer("test-server");
    const unsupported = await server.handleRequest({
      method: "initialize",
      params: { protocolVersion: "2025-01-01" }
    });
    expect(unsupported.error?.code).toBe("PROTOCOL_VERSION_UNSUPPORTED");

    const missingToolName = await server.handleRequest({ method: "tools/call", params: {} });
    expect(missingToolName.error?.code).toBe("INVALID_PARAMS");

    const missingResourceUri = await server.handleRequest({ method: "resources/read", params: {} });
    expect(missingResourceUri.error?.code).toBe("INVALID_PARAMS");
  });
});
