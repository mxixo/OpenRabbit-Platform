import { AgentDefinition } from "../interfaces/agent-registry.js";
import {
  AgentRegisteredPayload,
  AgentStateEvent,
  AgentStateEventInput,
  AgentStateEventStore,
  AgentStateReconstructionPoint,
  AgentStateSnapshot
} from "../interfaces/agent-state-events.js";

export class InMemoryAgentStateEventStore implements AgentStateEventStore {
  private readonly events: AgentStateEvent[] = [];
  private sequence = 0;

  append(event: AgentStateEventInput): AgentStateEvent {
    this.sequence += 1;
    const stored: AgentStateEvent = {
      eventId: event.eventId ?? `agent-event-${this.sequence}`,
      sequence: this.sequence,
      agentId: event.agentId,
      type: event.type,
      timestamp: event.timestamp ?? new Date().toISOString(),
      payload: event.payload,
      metadata: event.metadata
    };
    this.events.push(stored);
    return stored;
  }

  listByAgent(agentId: string): AgentStateEvent[] {
    return this.events
      .filter((event) => event.agentId === agentId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  reconstruct(
    agentId: string,
    point?: AgentStateReconstructionPoint
  ): AgentStateSnapshot {
    const asOfTimestampMs = point?.asOfTimestamp
      ? Date.parse(point.asOfTimestamp)
      : undefined;
    const timeline = this.listByAgent(agentId).filter((event) =>
      isEventWithinPoint(event, point?.asOfSequence, asOfTimestampMs)
    );

    let current: AgentDefinition | undefined;
    let exists = false;

    for (const event of timeline) {
      switch (event.type) {
        case "agent.registered":
          current = applyRegistered(event.agentId, event.payload);
          exists = true;
          break;
        case "agent.status.updated":
          if (current) {
            current = {
              ...current,
              status: String(event.payload.status) as AgentDefinition["status"]
            };
          }
          break;
        case "agent.capabilities.updated":
          if (current) {
            current = {
              ...current,
              capabilities: toStringArray(event.payload.capabilities)
            };
          }
          break;
        case "agent.tags.updated":
          if (current) {
            current = {
              ...current,
              tags: toOptionalStringArray(event.payload.tags)
            };
          }
          break;
        case "agent.metadata.merged":
          if (current) {
            current = {
              ...current,
              metadata: {
                ...(current.metadata ?? {}),
                ...toRecord(event.payload.metadata)
              }
            };
          }
          break;
        case "agent.unregistered":
          current = undefined;
          exists = false;
          break;
      }
    }

    return {
      agentId,
      exists,
      state: current,
      lastEventSequence: timeline[timeline.length - 1]?.sequence,
      reconstructedAt: new Date().toISOString()
    };
  }
}

function isEventWithinPoint(
  event: AgentStateEvent,
  asOfSequence?: number,
  asOfTimestampMs?: number
): boolean {
  if (asOfSequence !== undefined && event.sequence > asOfSequence) {
    return false;
  }
  if (asOfTimestampMs !== undefined) {
    const eventTimestampMs = Date.parse(event.timestamp);
    if (!Number.isNaN(eventTimestampMs) && eventTimestampMs > asOfTimestampMs) {
      return false;
    }
  }
  return true;
}

function applyRegistered(agentId: string, payload: Record<string, unknown>): AgentDefinition {
  const typed = toRegisteredPayload(payload);
  return {
    id: agentId,
    name: typed.name,
    capabilities: typed.capabilities ?? [],
    tags: typed.tags,
    status: typed.status,
    metadata: typed.metadata
  };
}

function toRegisteredPayload(payload: Record<string, unknown>): AgentRegisteredPayload {
  return {
    name: typeof payload.name === "string" ? payload.name : "unknown",
    capabilities: toStringArray(payload.capabilities),
    tags: toOptionalStringArray(payload.tags),
    status: toAgentStatus(payload.status),
    metadata: toRecord(payload.metadata)
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return toStringArray(value);
}

function toAgentStatus(value: unknown): AgentDefinition["status"] {
  if (value === "active" || value === "inactive" || value === "blocked") {
    return value;
  }
  return "inactive";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
