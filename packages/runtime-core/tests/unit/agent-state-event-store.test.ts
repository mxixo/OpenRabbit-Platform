import { describe, expect, it } from "vitest";
import { InMemoryAgentStateEventStore } from "../../src/core/in-memory-agent-state-event-store.js";

describe("InMemoryAgentStateEventStore", () => {
  it("reconstructs latest agent state from an event timeline", () => {
    const store = new InMemoryAgentStateEventStore();
    store.append({
      agentId: "agent-1",
      type: "agent.registered",
      payload: {
        name: "planner",
        capabilities: ["plan"],
        tags: ["core"],
        status: "active"
      }
    });
    store.append({
      agentId: "agent-1",
      type: "agent.status.updated",
      payload: { status: "blocked" }
    });
    store.append({
      agentId: "agent-1",
      type: "agent.metadata.merged",
      payload: { metadata: { owner: "ops" } }
    });

    const snapshot = store.reconstruct("agent-1");

    expect(snapshot.exists).toBe(true);
    expect(snapshot.state).toMatchObject({
      id: "agent-1",
      name: "planner",
      status: "blocked",
      metadata: { owner: "ops" }
    });
    expect(snapshot.lastEventSequence).toBe(3);
  });

  it("reconstructs point-in-time state by sequence", () => {
    const store = new InMemoryAgentStateEventStore();
    store.append({
      eventId: "evt-1",
      timestamp: "2026-07-18T08:00:00.000Z",
      agentId: "agent-2",
      type: "agent.registered",
      payload: {
        name: "executor",
        capabilities: ["execute"],
        status: "active"
      }
    });
    store.append({
      eventId: "evt-2",
      timestamp: "2026-07-18T08:01:00.000Z",
      agentId: "agent-2",
      type: "agent.status.updated",
      payload: { status: "inactive" }
    });

    const asOfFirstEvent = store.reconstruct("agent-2", { asOfSequence: 1 });
    const latest = store.reconstruct("agent-2");

    expect(asOfFirstEvent.state?.status).toBe("active");
    expect(latest.state?.status).toBe("inactive");
  });

  it("reconstructs point-in-time state by timestamp and supports unregister events", () => {
    const store = new InMemoryAgentStateEventStore();
    store.append({
      timestamp: "2026-07-18T08:00:00.000Z",
      agentId: "agent-3",
      type: "agent.registered",
      payload: {
        name: "observer",
        capabilities: ["observe"],
        status: "active"
      }
    });
    store.append({
      timestamp: "2026-07-18T08:01:00.000Z",
      agentId: "agent-3",
      type: "agent.unregistered",
      payload: {}
    });

    const beforeRemoval = store.reconstruct("agent-3", {
      asOfTimestamp: "2026-07-18T08:00:30.000Z"
    });
    const afterRemoval = store.reconstruct("agent-3", {
      asOfTimestamp: "2026-07-18T08:02:00.000Z"
    });

    expect(beforeRemoval.exists).toBe(true);
    expect(afterRemoval.exists).toBe(false);
    expect(afterRemoval.state).toBeUndefined();
  });
});
