import { describe, expect, it } from "vitest";
import { InMemoryToolRegistry } from "../../src/core/in-memory-tool-registry.js";

describe("InMemoryToolRegistry", () => {
  it("registers, lists and invokes tools", async () => {
    const registry = new InMemoryToolRegistry();
    registry.register(
      { name: "echo", description: "echo tool" },
      async (input) => ({ echoed: input })
    );

    expect(registry.list()).toHaveLength(1);
    const output = await registry.invoke("echo", { msg: "hi" });
    expect(output).toEqual({ echoed: { msg: "hi" } });
  });

  it("rejects duplicate registration", () => {
    const registry = new InMemoryToolRegistry();
    registry.register({ name: "echo", description: "tool" }, () => "ok");
    expect(() =>
      registry.register({ name: "echo", description: "tool" }, () => "ok")
    ).toThrow("Tool already registered");
  });
});
