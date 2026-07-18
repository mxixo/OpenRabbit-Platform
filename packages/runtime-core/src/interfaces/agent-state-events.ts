import { AgentDefinition, AgentStatus } from "./agent-registry.js";

export type AgentStateEventType =
  | "agent.registered"
  | "agent.status.updated"
  | "agent.capabilities.updated"
  | "agent.tags.updated"
  | "agent.metadata.merged"
  | "agent.unregistered";

export interface AgentStateEvent {
  eventId: string;
  sequence: number;
  agentId: string;
  type: AgentStateEventType;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentStateEventInput {
  eventId?: string;
  agentId: string;
  type: AgentStateEventType;
  timestamp?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentStateReconstructionPoint {
  asOfSequence?: number;
  asOfTimestamp?: string;
}

export interface AgentStateSnapshot {
  agentId: string;
  exists: boolean;
  state?: AgentDefinition;
  lastEventSequence?: number;
  reconstructedAt: string;
}

export interface AgentStateEventStore {
  append(event: AgentStateEventInput): AgentStateEvent;
  listByAgent(agentId: string): AgentStateEvent[];
  reconstruct(
    agentId: string,
    point?: AgentStateReconstructionPoint
  ): AgentStateSnapshot;
}

export interface AgentRegisteredPayload {
  name: string;
  capabilities: string[];
  tags?: string[];
  status: AgentStatus;
  metadata?: Record<string, unknown>;
}
