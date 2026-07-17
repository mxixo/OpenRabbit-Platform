import {
  McpClient,
  McpRequest,
  McpResponse,
  McpToolDefinition
} from "../interfaces/mcp.js";

type ToolHandler = (args?: Record<string, unknown>) => unknown | Promise<unknown>;
type MethodHandler = (request: McpRequest) => McpResponse | Promise<McpResponse>;

export class MockMcpClient implements McpClient {
  private readonly tools = new Map<string, { definition: McpToolDefinition; handler: ToolHandler }>();
  private readonly methodHandlers = new Map<string, MethodHandler>();

  registerTool(definition: McpToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`MCP tool already registered: ${definition.name}`);
    }
    this.tools.set(definition.name, { definition, handler });
  }

  registerMethod(method: string, handler: MethodHandler): void {
    this.methodHandlers.set(method, handler);
  }

  async listTools(): Promise<McpToolDefinition[]> {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`MCP tool not found: ${name}`);
    }
    return tool.handler(args);
  }

  async request(request: McpRequest): Promise<McpResponse> {
    const handler = this.methodHandlers.get(request.method);
    if (!handler) {
      return {
        id: request.id,
        error: {
          code: "METHOD_NOT_FOUND",
          message: `No handler for method: ${request.method}`
        }
      };
    }
    return handler(request);
  }
}
