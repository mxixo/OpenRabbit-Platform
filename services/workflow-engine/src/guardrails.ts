import {
  WorkflowExecutionContext,
  WorkflowGuardrails,
  WorkflowStepDefinition
} from "./contracts.js";

export interface GuardrailEvaluation {
  allowed: boolean;
  reason?: string;
  blockedByApproval?: boolean;
}

export function evaluateGuardrails(
  step: WorkflowStepDefinition,
  context: WorkflowExecutionContext,
  options?: { policyAllowed?: boolean }
): GuardrailEvaluation {
  const guardrails: WorkflowGuardrails = step.guardrails;

  if (guardrails.policyCheck && options?.policyAllowed === false) {
    return {
      allowed: false,
      reason: "Policy pre-check denied step"
    };
  }

  if (guardrails.requiresApproval) {
    const approved = context.approvals?.[step.id] === true;
    if (!approved) {
      return {
        allowed: false,
        reason: "Approval required",
        blockedByApproval: true
      };
    }
  }

  return { allowed: true };
}

export function isRetryAllowed(attempt: number, maxRetries: number): boolean {
  return attempt <= maxRetries;
}
