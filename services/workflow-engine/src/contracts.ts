export type WorkflowStatus = "idle" | "running" | "blocked" | "failed" | "completed";

export interface WorkflowGuardrails {
  policyCheck: boolean;
  requiresApproval: boolean;
  maxRetries: number;
  timeoutMs?: number;
}

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  action: string;
  guardrails: WorkflowGuardrails;
}

export interface WorkflowDefinition {
  workflowId: string;
  version: string;
  name: string;
  description?: string;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowExecutionContext {
  correlationId: string;
  initiatedBy: string;
  variables: Record<string, unknown>;
  approvals?: Record<string, boolean>;
}

export type WorkflowEventType =
  | "workflow.started"
  | "workflow.step.started"
  | "workflow.step.completed"
  | "workflow.step.blocked"
  | "workflow.step.failed"
  | "workflow.completed"
  | "workflow.failed";

export interface WorkflowExecutionEvent {
  type: WorkflowEventType;
  workflowId: string;
  stepId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface WorkflowStepOutcome {
  ok: boolean;
  output?: unknown;
  error?: string;
  recoverable?: boolean;
}

export interface WorkflowActionHandlers {
  [actionName: string]: (
    context: WorkflowExecutionContext,
    step: WorkflowStepDefinition
  ) => Promise<WorkflowStepOutcome> | WorkflowStepOutcome;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: WorkflowStatus;
  completedSteps: string[];
  blockedStepId?: string;
  failedStepId?: string;
  deadLetterReason?: string;
  events: WorkflowExecutionEvent[];
}

export interface WorkflowRetryPolicy {
  maxAttempts: number;
  backoffMs?: number;
}

export interface WorkflowDeadLetterOutcome {
  workflowId: string;
  stepId: string;
  reason: string;
  timestamp: string;
}

export interface WorkflowStateSnapshot {
  workflowId: string;
  status: WorkflowStatus;
  completedSteps: string[];
  lastStepId?: string;
  context: WorkflowExecutionContext;
  timestamp: string;
}

export interface WorkflowRunner {
  run(
    definition: WorkflowDefinition,
    context: WorkflowExecutionContext,
    handlers: WorkflowActionHandlers
  ): Promise<WorkflowExecutionResult>;
}
