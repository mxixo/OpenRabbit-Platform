import type { McpRequestEnvelope } from "../../contracts/src/index.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateMcpRequestEnvelope(input: unknown): ValidationResult {
  const errors: string[] = [];
  const value = input as Partial<McpRequestEnvelope>;
  if (!value || typeof value !== "object") {
    errors.push("request must be an object");
  } else {
    if (!value.method || typeof value.method !== "string") {
      errors.push("method is required");
    }
    if (value.id !== undefined && typeof value.id !== "string") {
      errors.push("id must be a string when provided");
    }
    if (
      value.params !== undefined &&
      (typeof value.params !== "object" || value.params === null || Array.isArray(value.params))
    ) {
      errors.push("params must be an object when provided");
    }
    const params = value.params as Record<string, unknown> | undefined;
    if (value.method === "initialize") {
      if (typeof params?.protocolVersion !== "string" || params.protocolVersion.length === 0) {
        errors.push("initialize params.protocolVersion is required");
      }
    }
    if (value.method === "tools/call" && typeof params?.name !== "string") {
      errors.push("tools/call params.name is required");
    }
    if (value.method === "resources/read" && typeof params?.uri !== "string") {
      errors.push("resources/read params.uri is required");
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
