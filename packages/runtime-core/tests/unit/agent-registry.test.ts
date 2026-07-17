import { describe, expect, it } from "vitest";
import { InMemoryAgentRegistry } from "../../src/core/in-memory-agent-registry.js";

describe("InMemoryAgentRegistry", () => {
  it("registers agents and updates status", () => {
    const registry = new InMemoryAgentRegistry();
    registry.register({
      id: "agent-1",
      name: "planner",
      capabilities: ["plan"],
      tags: ["core"],
      status: "active"
    });
    registry.updateStatus("agent-1", "blocked");

    expect(registry.get("agent-1")?.status).toBe("blocked");
    expect(registry.findByTag("core")).toHaveLength(1);
  });

  it("throws on unknown agent status updates", () => {
    const registry = new InMemoryAgentRegistry();
    expect(() => registry.updateStatus("missing", "active")).toThrow("Agent not found");
  });
});
