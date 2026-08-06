import {
  RuntimeProvider,
  RuntimeProviderCapability,
  RuntimeSession,
  RuntimeSessionStart,
  RuntimeTaskRequest,
  RuntimeTaskResult,
  ToolRef
} from "../interfaces/runtime-provider.js";

export type MockRuntimeTaskHandler = (
  request: RuntimeTaskRequest,
  session: RuntimeSession
) => RuntimeTaskResult | Promise<RuntimeTaskResult>;

/**
 * Deterministic RuntimeProvider for unit tests and local demos.
 * Not an OpenClaw adapter — adapters belong under runtimes/<name>/.
 */
export class MockRuntimeProvider implements RuntimeProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: readonly RuntimeProviderCapability[];

  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly sessionTools = new Map<string, ToolRef[]>();
  private taskHandler: MockRuntimeTaskHandler;

  constructor(
    options: {
      id?: string;
      displayName?: string;
      capabilities?: RuntimeProviderCapability[];
      taskHandler?: MockRuntimeTaskHandler;
    } = {}
  ) {
    this.id = options.id ?? "mock-runtime";
    this.displayName = options.displayName ?? "Mock Runtime";
    this.capabilities = options.capabilities ?? ["tools", "multi-session"];
    this.taskHandler =
      options.taskHandler ??
      ((request, session) => ({
        taskId: request.taskId,
        sessionId: session.sessionId,
        status: "completed",
        output: {
          echo: request.input,
          taskType: request.taskType,
          workerId: session.workerId
        },
        completedAt: new Date().toISOString()
      }));
  }

  setTaskHandler(handler: MockRuntimeTaskHandler): void {
    this.taskHandler = handler;
  }

  async startSession(input: RuntimeSessionStart): Promise<RuntimeSession> {
    const sessionId = `sess_${this.id}_${input.workerId}_${input.requestId}`;
    const session: RuntimeSession = {
      sessionId,
      runtimeProviderId: this.id,
      orgId: input.orgId,
      workerId: input.workerId,
      status: "ready",
      createdAt: new Date().toISOString(),
      metadata: {
        ...input.metadata,
        allowedCapabilities: input.allowedCapabilities ?? [],
        memoryScope: input.memoryScope
      }
    };
    this.sessions.set(sessionId, session);
    this.sessionTools.set(sessionId, [...(input.projectedTools ?? [])]);
    return session;
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Runtime session not found: ${sessionId}`);
    }
    this.sessions.set(sessionId, { ...session, status: "stopped" });
    this.sessionTools.delete(sessionId);
  }

  async runTask(input: RuntimeTaskRequest): Promise<RuntimeTaskResult> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      return {
        taskId: input.taskId,
        sessionId: input.sessionId,
        status: "failed",
        error: {
          code: "session_not_found",
          message: `Runtime session not found: ${input.sessionId}`
        },
        completedAt: new Date().toISOString()
      };
    }
    if (session.status === "stopped" || session.status === "failed") {
      return {
        taskId: input.taskId,
        sessionId: input.sessionId,
        status: "failed",
        error: {
          code: "session_not_runnable",
          message: `Runtime session is ${session.status}`
        },
        completedAt: new Date().toISOString()
      };
    }

    this.sessions.set(input.sessionId, { ...session, status: "busy" });
    try {
      const result = await this.taskHandler(input, session);
      this.sessions.set(input.sessionId, { ...session, status: "ready" });
      return result;
    } catch (error) {
      this.sessions.set(input.sessionId, { ...session, status: "ready" });
      return {
        taskId: input.taskId,
        sessionId: input.sessionId,
        status: "failed",
        error: {
          code: "runtime_handler_error",
          message: error instanceof Error ? error.message : "Runtime handler failed",
          retryable: true
        },
        completedAt: new Date().toISOString()
      };
    }
  }

  async listProjectedTools(sessionId: string): Promise<ToolRef[]> {
    return [...(this.sessionTools.get(sessionId) ?? [])];
  }

  async getSession(sessionId: string): Promise<RuntimeSession | undefined> {
    return this.sessions.get(sessionId);
  }
}
