import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "../../src/core/in-memory-event-bus.js";

describe("InMemoryEventBus", () => {
  it("publishes events and supports unsubscribe", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("agent.started", handler);

    await bus.publish({
      type: "agent.started",
      payload: { id: "a1" },
      timestamp: new Date().toISOString()
    });
    unsubscribe();
    await bus.publish({
      type: "agent.started",
      payload: { id: "a2" },
      timestamp: new Date().toISOString()
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("isolates handler failures", async () => {
    const bus = new InMemoryEventBus();
    bus.subscribe("evt", () => {
      throw new Error("bad handler");
    });
    bus.subscribe("evt", () => undefined);

    const result = await bus.publish({
      type: "evt",
      payload: {},
      timestamp: new Date().toISOString()
    });

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
  });
});
