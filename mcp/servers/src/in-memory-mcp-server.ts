import {
  InMemoryMcpRegistryAdapter,
  type RegistryResourceReader,
  type RegistryToolHandler
} from "../../adapters/src/index.js";
import type {
  McpRequestEnvelope,
  McpResourceDescriptor,
  McpResourceReadResult,
  McpResponseEnvelope,
  McpServerDescriptor,
  McpToolCallResult,
  McpToolDescriptor
} from "../../contracts/src/index.js";

export interface McpServer {
  descriptor(): McpServerDescriptor;
  registerTool(descriptor: McpToolDescriptor, handler: RegistryToolHandler): void;
  registerResource(descriptor: McpResourceDescriptor, reader: RegistryResourceReader): void;
  listTools(): McpToolDescriptor[];
  listResources(): McpResourceDescriptor[];
  callTool(name: string, args?: Record<string, unknown>): Promise<McpToolCallResult>;
  readResource(uri: string): Promise<McpResourceReadResult>;
  handleRequest(request: McpRequestEnvelope): Promise<McpResponseEnvelope>;
}

export function createInMemoryMcpServer(
  serverName: string,
  version = "0.1.0"
): McpServer {
  const registry = new InMemoryMcpRegistryAdapter();
  const serverDescriptor: McpServerDescriptor = {
    serverName,
    version,
    protocolVersion: "2026-07-17",
    capabilities: ["tools", "resources", "requests"]
  };

  return {
    descriptor(): McpServerDescriptor {
      return serverDescriptor;
    },
    registerTool(descriptor: McpToolDescriptor, handler: RegistryToolHandler): void {
      registry.registerTool(descriptor, handler);
    },
    registerResource(descriptor: McpResourceDescriptor, reader: RegistryResourceReader): void {
      registry.registerResource(descriptor, reader);
    },
    listTools(): McpToolDescriptor[] {
      return registry.listTools();
    },
    listResources(): McpResourceDescriptor[] {
      return registry.listResources();
    },
    async callTool(name: string, args?: Record<string, unknown>): Promise<McpToolCallResult> {
      const handler = registry.getToolHandler(name);
      if (!handler) {
        return {
          ok: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool not found: ${name}`
          }
        };
      }
      return { ok: true, output: await handler(args) };
    },
    async readResource(uri: string): Promise<McpResourceReadResult> {
      const reader = registry.getResourceReader(uri);
      if (!reader) {
        return {
          ok: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `Resource not found: ${uri}`
          }
        };
      }
      return {
        ok: true,
        resource: {
          uri,
          content: await reader()
        }
      };
    },
    async handleRequest(request: McpRequestEnvelope): Promise<McpResponseEnvelope> {
      if (request.method === "tools/list") {
        return { id: request.id, result: this.listTools() };
      }
      if (request.method === "resources/list") {
        return { id: request.id, result: this.listResources() };
      }
      if (request.method === "tools/call") {
        const params = request.params ?? {};
        const result = await this.callTool(
          String(params.name ?? ""),
          (params.args as Record<string, unknown> | undefined) ?? {}
        );
        return { id: request.id, result };
      }
      if (request.method === "resources/read") {
        const params = request.params ?? {};
        const result = await this.readResource(String(params.uri ?? ""));
        return { id: request.id, result };
      }
      return {
        id: request.id,
        error: {
          code: "METHOD_NOT_SUPPORTED",
          message: `Unsupported MCP method: ${request.method}`
        }
      };
    }
  };
}
