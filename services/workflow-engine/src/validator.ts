import { WorkflowDefinition } from "./contracts.js";

export interface DefinitionValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorkflowDefinition(
  definition: WorkflowDefinition
): DefinitionValidationResult {
  const errors: string[] = [];
  if (!definition.workflowId) {
    errors.push("workflowId is required");
  }
  if (!definition.version) {
    errors.push("version is required");
  }
  if (!definition.steps?.length) {
    errors.push("at least one step is required");
  }
  const seenStepIds = new Set<string>();
  for (const step of definition.steps ?? []) {
    if (!step.id) {
      errors.push("step id is required");
    } else if (seenStepIds.has(step.id)) {
      errors.push(`duplicate step id: ${step.id}`);
    } else {
      seenStepIds.add(step.id);
    }
    if (!step.action) {
      errors.push(`step action is required for step ${step.id || "<unknown>"}`);
    }
    if (step.guardrails.maxRetries < 0) {
      errors.push(`maxRetries cannot be negative for step ${step.id || "<unknown>"}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
