import type {
  McpResourceDescriptor,
  McpToolDescriptor
} from "../../contracts/src/index.js";

export type RegistryToolHandler = (args?: Record<string, unknown>) => unknown | Promise<unknown>;
export type RegistryResourceReader = () => string | Promise<string>;

export class InMemoryMcpRegistryAdapter {
  private readonly tools = new Map<string, { descriptor: McpToolDescriptor; handler: RegistryToolHandler }>();
  private readonly resources = new Map<
    string,
    { descriptor: McpResourceDescriptor; reader: RegistryResourceReader }
  >();

  registerTool(descriptor: McpToolDescriptor, handler: RegistryToolHandler): void {
    if (this.tools.has(descriptor.name)) {
      throw new Error(`Tool already registered: ${descriptor.name}`);
    }
    this.tools.set(descriptor.name, { descriptor, handler });
  }

  registerResource(descriptor: McpResourceDescriptor, reader: RegistryResourceReader): void {
    if (this.resources.has(descriptor.uri)) {
      throw new Error(`Resource already registered: ${descriptor.uri}`);
    }
    this.resources.set(descriptor.uri, { descriptor, reader });
  }

  listTools(): McpToolDescriptor[] {
    return [...this.tools.values()].map((entry) => entry.descriptor);
  }

  listResources(): McpResourceDescriptor[] {
    return [...this.resources.values()].map((entry) => entry.descriptor);
  }

  getToolHandler(name: string): RegistryToolHandler | undefined {
    return this.tools.get(name)?.handler;
  }

  getResourceReader(uri: string): RegistryResourceReader | undefined {
    return this.resources.get(uri)?.reader;
  }
}
