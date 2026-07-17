export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpRequest {
  id?: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  id?: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface McpClient {
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  request(request: McpRequest): Promise<McpResponse>;
}
