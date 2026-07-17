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
    if (value.params !== undefined && typeof value.params !== "object") {
      errors.push("params must be an object when provided");
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
