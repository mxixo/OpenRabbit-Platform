import type { McpClient } from "../../../packages/runtime-core/src/interfaces/mcp.js";
import type {
  McpRequestEnvelope,
  McpResponseEnvelope,
  McpToolDescriptor
} from "../../contracts/src/index.js";

export class RuntimeCoreMcpAdapter {
  constructor(private readonly client: McpClient) {}

  async listTools(): Promise<McpToolDescriptor[]> {
    const tools = await this.client.listTools();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    return this.client.callTool(name, args);
  }

  async request(input: McpRequestEnvelope): Promise<McpResponseEnvelope> {
    return this.client.request({
      id: input.id,
      method: input.method,
      params: input.params
    });
  }
}
