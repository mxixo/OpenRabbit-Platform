import {
  AgentDefinition,
  AgentRegistry,
  AgentStatus
} from "../interfaces/agent-registry.js";

export class InMemoryAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, agent);
  }

  get(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  updateStatus(agentId: string, status: AgentStatus): void {
    const current = this.agents.get(agentId);
    if (!current) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    this.agents.set(agentId, {
      ...current,
      status
    });
  }

  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  findByTag(tag: string): AgentDefinition[] {
    return [...this.agents.values()].filter((agent) => (agent.tags ?? []).includes(tag));
  }
}
