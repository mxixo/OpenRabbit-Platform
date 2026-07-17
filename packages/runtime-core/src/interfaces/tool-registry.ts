export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags?: string[];
}

export type ToolHandler = (
  input: unknown,
  context?: Record<string, unknown>
) => unknown | Promise<unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export interface ToolRegistry {
  register(definition: ToolDefinition, handler: ToolHandler): void;
  get(name: string): RegisteredTool | undefined;
  list(): ToolDefinition[];
  invoke(
    name: string,
    input: unknown,
    context?: Record<string, unknown>
  ): Promise<unknown>;
}
