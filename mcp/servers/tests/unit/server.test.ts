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
});
