import {
  WorkflowActionHandlers,
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionEvent,
  WorkflowExecutionResult,
  WorkflowRetryPolicy,
  WorkflowRunner
} from "./contracts.js";
import { evaluateGuardrails, isRetryAllowed } from "./guardrails.js";
import { validateWorkflowDefinition } from "./validator.js";

function createEvent(
  type: WorkflowExecutionEvent["type"],
  workflowId: string,
  details?: Record<string, unknown>,
  stepId?: string
): WorkflowExecutionEvent {
  return {
    type,
    workflowId,
    stepId,
    timestamp: new Date().toISOString(),
    details
  };
}

export class InMemoryWorkflowRunner implements WorkflowRunner {
  constructor(private readonly retryPolicy: WorkflowRetryPolicy = { maxAttempts: 3 }) {}

  async run(
    definition: WorkflowDefinition,
    context: WorkflowExecutionContext,
    handlers: WorkflowActionHandlers
  ): Promise<WorkflowExecutionResult> {
    const validation = validateWorkflowDefinition(definition);
    const completedSteps: string[] = [];
    const events: WorkflowExecutionEvent[] = [
      createEvent("workflow.started", definition.workflowId, {
        correlationId: context.correlationId
      })
    ];

    if (!validation.valid) {
      events.push(
        createEvent("workflow.failed", definition.workflowId, {
          errors: validation.errors
        })
      );
      return {
        workflowId: definition.workflowId,
        status: "failed",
        completedSteps,
        deadLetterReason: validation.errors.join("; "),
        events
      };
    }

    for (const step of definition.steps) {
      events.push(createEvent("workflow.step.started", definition.workflowId, undefined, step.id));
      const guardrail = evaluateGuardrails(step, context, { policyAllowed: true });
      if (!guardrail.allowed) {
        events.push(
          createEvent(
            "workflow.step.blocked",
            definition.workflowId,
            { reason: guardrail.reason },
            step.id
          )
        );
        return {
          workflowId: definition.workflowId,
          status: "blocked",
          completedSteps,
          blockedStepId: step.id,
          events
        };
      }

      const handler = handlers[step.action];
      if (!handler) {
        events.push(
          createEvent(
            "workflow.step.failed",
            definition.workflowId,
            { reason: `No handler for action ${step.action}` },
            step.id
          )
        );
        events.push(
          createEvent(
            "workflow.failed",
            definition.workflowId,
            { reason: `No handler for action ${step.action}` },
            step.id
          )
        );
        return {
          workflowId: definition.workflowId,
          status: "failed",
          completedSteps,
          failedStepId: step.id,
          deadLetterReason: `No handler for action ${step.action}`,
          events
        };
      }

      let attempt = 0;
      let succeeded = false;
      let failureReason = "unknown error";
      while (!succeeded && isRetryAllowed(attempt, step.guardrails.maxRetries)) {
        attempt += 1;
        if (attempt > this.retryPolicy.maxAttempts) {
          failureReason = "retry policy max attempts reached";
          break;
        }
        const result = await handler(context, step);
        if (result.ok) {
          succeeded = true;
          completedSteps.push(step.id);
          events.push(
            createEvent(
              "workflow.step.completed",
              definition.workflowId,
              { output: result.output, attempt },
              step.id
            )
          );
          break;
        }
        failureReason = result.error ?? "step failed";
        if (!result.recoverable) {
          break;
        }
      }

      if (!succeeded) {
        events.push(
          createEvent(
            "workflow.step.failed",
            definition.workflowId,
            { reason: failureReason },
            step.id
          )
        );
        events.push(
          createEvent("workflow.failed", definition.workflowId, { reason: failureReason }, step.id)
        );
        return {
          workflowId: definition.workflowId,
          status: "failed",
          completedSteps,
          failedStepId: step.id,
          deadLetterReason: failureReason,
          events
        };
      }
    }

    events.push(createEvent("workflow.completed", definition.workflowId));
    return {
      workflowId: definition.workflowId,
      status: "completed",
      completedSteps,
      events
    };
  }
}
