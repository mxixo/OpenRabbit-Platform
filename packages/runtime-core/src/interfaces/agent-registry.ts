export type AgentStatus = "active" | "inactive" | "blocked";

export interface AgentDefinition {
  id: string;
  name: string;
  capabilities: string[];
  tags?: string[];
  status: AgentStatus;
  metadata?: Record<string, unknown>;
}

export interface AgentRegistry {
  register(agent: AgentDefinition): void;
  get(agentId: string): AgentDefinition | undefined;
  updateStatus(agentId: string, status: AgentStatus): void;
  list(): AgentDefinition[];
  findByTag(tag: string): AgentDefinition[];
}
