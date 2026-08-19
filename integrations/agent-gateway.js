"use strict";

/**
 * Provider-neutral agent gateway.
 *
 * OpenRabbit owns context, policy, approvals and audit metadata.
 * Providers own reasoning and may expose their own tools. Direct OpenRabbit
 * adapters may also be registered as callable tools.
 */

class AgentGateway {
  constructor({ providers = {}, toolRegistry = {}, approvalPolicy, audit }) {
    this.providers = providers;
    this.toolRegistry = toolRegistry;
    this.approvalPolicy = approvalPolicy || { requiresApproval: () => true };
    this.audit = audit || { record: async () => {} };
  }

  getProvider(name) {
    const provider = this.providers[name];
    if (!provider || typeof provider.run !== "function") {
      throw new Error(`Agent provider not configured: ${name}`);
    }
    return provider;
  }

  resolveTools(toolNames = []) {
    return toolNames.map((name) => {
      const tool = this.toolRegistry[name];
      if (!tool) throw new Error(`Unknown OpenRabbit tool: ${name}`);
      return tool;
    });
  }

  async run({ provider: providerName, input, context = {}, toolNames = [], providerTools = [], actor }) {
    const provider = this.getProvider(providerName);
    const tools = this.resolveTools(toolNames);
    const response = await provider.run({
      input,
      context,
      tools,
      providerTools,
      policy: this.approvalPolicy,
    });

    const proposedActions = (response.proposedActions || []).map((action) => ({
      ...action,
      approvalRequired: this.approvalPolicy.requiresApproval(action, context),
    }));

    await this.audit.record({
      type: "agent.run",
      actor,
      provider: providerName,
      inputSummary: String(input || "").slice(0, 500),
      contextKeys: Object.keys(context),
      proposedActionCount: proposedActions.length,
      toolTrace: response.toolTrace || [],
      timestamp: new Date().toISOString(),
    });

    return { ...response, proposedActions };
  }
}

module.exports = { AgentGateway };