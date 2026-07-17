export type McpProtocolVersion = "2026-07-17";

export interface McpErrorShape {
  code: string;
  message: string;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResourceDescriptor {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpServerDescriptor {
  serverName: string;
  version: string;
  protocolVersion: McpProtocolVersion;
  capabilities: string[];
}

export interface McpRequestEnvelope {
  id?: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponseEnvelope {
  id?: string;
  result?: unknown;
  error?: McpErrorShape;
}

export interface McpToolCallResult {
  ok: boolean;
  output?: unknown;
  error?: McpErrorShape;
}

export interface McpResourceReadResult {
  ok: boolean;
  resource?: {
    uri: string;
    content: string;
    mimeType?: string;
  };
  error?: McpErrorShape;
}

export function isMcpRequestEnvelope(value: unknown): value is McpRequestEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const request = value as Partial<McpRequestEnvelope>;
  return typeof request.method === "string" && request.method.length > 0;
}
