import { describe, expect, it } from "vitest";
import { MockMcpClient } from "../../src/mocks/mock-mcp-client.js";

describe("MockMcpClient", () => {
  it("lists and calls registered tools", async () => {
    const client = new MockMcpClient();
    client.registerTool(
      { name: "lookup", description: "lookup data" },
      async (args) => ({ ok: true, args })
    );

    const tools = await client.listTools();
    const result = await client.callTool("lookup", { id: "42" });

    expect(tools).toHaveLength(1);
    expect(result).toEqual({ ok: true, args: { id: "42" } });
  });

  it("returns method-not-found for unhandled requests", async () => {
    const client = new MockMcpClient();
    const response = await client.request({ id: "1", method: "unknown" });
    expect(response.error?.code).toBe("METHOD_NOT_FOUND");
  });
});
