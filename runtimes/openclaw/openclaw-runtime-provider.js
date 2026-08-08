"use strict";

const RUNNABLE_SESSION_STATUSES = new Set(["ready", "busy"]);
const TERMINAL_SESSION_STATUSES = new Set(["stopped", "failed"]);

function nowIso() {
  return new Date().toISOString();
}

function cloneTool(tool) {
  return {
    ...tool,
    tags: Array.isArray(tool.tags) ? [...tool.tags] : tool.tags,
    inputSchema: tool.inputSchema ? { ...tool.inputSchema } : tool.inputSchema,
  };
}

function cloneSession(session) {
  return {
    ...session,
    metadata: session.metadata ? { ...session.metadata } : session.metadata,
  };
}

/**
 * Concrete RuntimeProvider-compatible adapter for OpenClaw execution.
 *
 * The provider owns OpenRabbit-facing session/task semantics. The OpenClaw
 * transport itself is injected through `executor`, which keeps proprietary
 * CLI/MCP/API details isolated inside this runtime directory.
 */
class OpenClawRuntimeProvider {
  constructor(options = {}) {
    if (!options.executor || typeof options.executor.execute !== "function") {
      throw new Error("OpenClawRuntimeProvider requires an executor with execute()");
    }

    this.id = options.id || "openclaw";
    this.displayName = options.displayName || "OpenClaw";
    this.capabilities = Object.freeze([
      ...(options.capabilities || ["tools", "multi-session"]),
    ]);
    this.executor = options.executor;
    this.sessions = new Map();
  }

  async startSession(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Runtime session input is required");
    }
    if (!String(input.requestId || "").trim()) {
      throw new Error("Runtime session requestId is required");
    }
    if (!String(input.orgId || "").trim()) {
      throw new Error("Runtime session orgId is required");
    }
    if (!String(input.workerId || "").trim()) {
      throw new Error("Runtime session workerId is required");
    }

    const sessionId = `oc_${input.workerId}_${input.requestId}`;
    const session = {
      sessionId,
      runtimeProviderId: this.id,
      orgId: input.orgId,
      workerId: input.workerId,
      status: "ready",
      createdAt: nowIso(),
      metadata: input.metadata ? { ...input.metadata } : undefined,
    };

    this.sessions.set(sessionId, {
      session,
      projectedTools: (input.projectedTools || []).map(cloneTool),
      allowedCapabilities: [...(input.allowedCapabilities || [])],
      memoryScope: input.memoryScope,
    });

    return cloneSession(session);
  }

  async stopSession(sessionId) {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Runtime session not found: ${sessionId}`);
    }

    state.session = {
      ...state.session,
      status: "stopped",
    };
  }

  async runTask(input) {
    const state = this.sessions.get(input && input.sessionId);
    if (!state) {
      return this.failureResult(input, "session_not_found", `Runtime session not found: ${input && input.sessionId}`);
    }

    if (TERMINAL_SESSION_STATUSES.has(state.session.status)) {
      return this.failureResult(
        input,
        "session_not_runnable",
        `Runtime session is ${state.session.status}`
      );
    }

    if (!RUNNABLE_SESSION_STATUSES.has(state.session.status)) {
      return this.failureResult(
        input,
        "session_not_ready",
        `Runtime session is ${state.session.status}`,
        true
      );
    }

    state.session = { ...state.session, status: "busy" };

    try {
      const execution = await this.executor.execute(
        {
          taskId: input.taskId,
          taskType: input.taskType,
          input: input.input,
          timeoutMs: input.timeoutMs,
          metadata: input.metadata ? { ...input.metadata } : undefined,
        },
        {
          sessionId: state.session.sessionId,
          orgId: state.session.orgId,
          workerId: state.session.workerId,
          projectedTools: state.projectedTools.map(cloneTool),
          allowedCapabilities: [...state.allowedCapabilities],
          memoryScope: state.memoryScope,
          metadata: state.session.metadata ? { ...state.session.metadata } : undefined,
        }
      );

      state.session = { ...state.session, status: "ready" };

      const status = execution && execution.status ? execution.status : "completed";
      if (!["completed", "failed", "blocked", "cancelled"].includes(status)) {
        return this.failureResult(
          input,
          "invalid_executor_status",
          `OpenClaw executor returned unsupported status: ${status}`
        );
      }

      return {
        taskId: input.taskId,
        sessionId: input.sessionId,
        status,
        output: execution ? execution.output : undefined,
        error: execution && execution.error ? { ...execution.error } : undefined,
        events:
          execution && Array.isArray(execution.events)
            ? execution.events.map((event) => ({ ...event }))
            : undefined,
        completedAt: (execution && execution.completedAt) || nowIso(),
      };
    } catch (error) {
      state.session = { ...state.session, status: "ready" };
      return this.failureResult(
        input,
        "openclaw_executor_error",
        error instanceof Error ? error.message : "OpenClaw executor failed",
        true
      );
    }
  }

  async listProjectedTools(sessionId) {
    const state = this.sessions.get(sessionId);
    return state ? state.projectedTools.map(cloneTool) : [];
  }

  async getSession(sessionId) {
    const state = this.sessions.get(sessionId);
    return state ? cloneSession(state.session) : undefined;
  }

  failureResult(input, code, message, retryable = false) {
    return {
      taskId: (input && input.taskId) || "unknown-task",
      sessionId: (input && input.sessionId) || "unknown-session",
      status: "failed",
      error: {
        code,
        message,
        retryable,
      },
      completedAt: nowIso(),
    };
  }
}

module.exports = {
  OpenClawRuntimeProvider,
};
