import { describe, expect, it } from "vitest";
import { MockMcpClient } from "../../../../packages/runtime-core/src/mocks/mock-mcp-client.js";
import {
  InMemoryMcpRegistryAdapter,
  RuntimeCoreMcpAdapter,
  validateMcpRequestEnvelope
} from "../../src/index.js";

describe("mcp adapters", () => {
  it("bridges runtime-core client operations", async () => {
    const client = new MockMcpClient();
    client.registerTool({ name: "echo", description: "echo" }, async (args) => args);
    const adapter = new RuntimeCoreMcpAdapter(client);
    expect((await adapter.listTools())[0]?.name).toBe("echo");
    await expect(adapter.callTool("echo", { ok: true })).resolves.toEqual({ ok: true });
  });

  it("validates MCP request envelopes", () => {
    expect(validateMcpRequestEnvelope({ method: "tools/list" }).valid).toBe(true);
    expect(validateMcpRequestEnvelope({ method: 42 }).valid).toBe(false);
  });

  it("registers tools and resources in-memory", async () => {
    const registry = new InMemoryMcpRegistryAdapter();
    registry.registerTool(
      { name: "sum", description: "sum numbers" },
      (args) => (args?.a as number) + (args?.b as number)
    );
    registry.registerResource({ uri: "memo://1", name: "memo" }, () => "hello");
    expect(registry.listTools()).toHaveLength(1);
    expect(registry.listResources()).toHaveLength(1);
    expect(registry.getToolHandler("sum")?.({ a: 1, b: 2 })).toBe(3);
    expect(registry.getResourceReader("memo://1")?.()).toBe("hello");
  });
});
