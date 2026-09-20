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
import {
  InMemoryWorkflowIdempotencyStore,
  WorkflowIdempotencyStore,
  workflowIdempotencyScopeKey
} from "./reliability.js";
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export class InMemoryWorkflowRunner implements WorkflowRunner {
  constructor(
    private readonly retryPolicy: WorkflowRetryPolicy = { maxAttempts: 3 },
    private readonly idempotencyStore: WorkflowIdempotencyStore =
      new InMemoryWorkflowIdempotencyStore()
  ) {}

  async run(
    definition: WorkflowDefinition,
    context: WorkflowExecutionContext,
    handlers: WorkflowActionHandlers
  ): Promise<WorkflowExecutionResult> {
    const validation = validateWorkflowDefinition(definition);
    const completedSteps: string[] = [];
    const events: WorkflowExecutionEvent[] = [
      createEvent("workflow.started", definition.workflowId, {
        correlationId: context.correlationId,
        tenantId: context.tenantId
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

    let idempotencyScope: string | undefined;
    try {
      idempotencyScope = workflowIdempotencyScopeKey(definition, context);
    } catch (error) {
      const reason = errorMessage(error, "invalid idempotency scope");
      events.push(createEvent("workflow.failed", definition.workflowId, { reason }));
      return {
        workflowId: definition.workflowId,
        status: "failed",
        completedSteps,
        deadLetterReason: reason,
        events
      };
    }

    if (idempotencyScope) {
      try {
        const claim = await this.idempotencyStore.claim(idempotencyScope);
        if (claim.state === "completed") {
          return {
            ...claim.result,
            events: [
              ...claim.result.events,
              createEvent("workflow.replayed", definition.workflowId, {
                correlationId: context.correlationId,
                tenantId: context.tenantId,
                idempotencyKey: context.idempotencyKey
              })
            ]
          };
        }
        if (claim.state === "in_progress") {
          const reason = "duplicate idempotent workflow execution is already in progress";
          events.push(
            createEvent("workflow.step.blocked", definition.workflowId, {
              reason,
              tenantId: context.tenantId,
              idempotencyKey: context.idempotencyKey
            })
          );
          return {
            workflowId: definition.workflowId,
            status: "blocked",
            completedSteps,
            deadLetterReason: reason,
            events
          };
        }
      } catch (error) {
        const detail = errorMessage(error, "idempotency storage unavailable");
        const reason = `idempotency claim failed before side effects: ${detail}`;
        events.push(
          createEvent("workflow.failed", definition.workflowId, {
            reason,
            tenantId: context.tenantId,
            idempotencyKey: context.idempotencyKey,
            phase: "claim"
          })
        );
        return {
          workflowId: definition.workflowId,
          status: "failed",
          completedSteps,
          deadLetterReason: reason,
          events
        };
      }
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
    const completed: WorkflowExecutionResult = {
      workflowId: definition.workflowId,
      status: "completed",
      completedSteps,
      events
    };
    if (idempotencyScope) {
      try {
        await this.idempotencyStore.complete(idempotencyScope, completed);
      } catch (error) {
        const detail = errorMessage(error, "idempotency completion persistence failed");
        const reason =
          `workflow side effects completed but idempotency completion could not be persisted; ` +
          `provider reconciliation is required before retry: ${detail}`;
        events.push(
          createEvent("workflow.failed", definition.workflowId, {
            reason,
            tenantId: context.tenantId,
            idempotencyKey: context.idempotencyKey,
            phase: "complete"
          })
        );
        return {
          workflowId: definition.workflowId,
          status: "failed",
          completedSteps,
          deadLetterReason: reason,
          events
        };
      }
    }
    return completed;
  }
}
