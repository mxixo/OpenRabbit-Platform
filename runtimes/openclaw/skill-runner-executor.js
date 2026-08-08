"use strict";

/**
 * Compatibility executor that adapts the existing OpenRabbit skill runner
 * contract (`runner.run(skillName, input)`) to the OpenClaw RuntimeProvider.
 *
 * This lets current MVP skills run through the new runtime boundary without
 * rewriting business logic. A future OpenClaw CLI/MCP/API executor can replace
 * this class without changing WorkerOrchestrator or RuntimeProvider callers.
 */
class SkillRunnerOpenClawExecutor {
  constructor(runner) {
    if (!runner || typeof runner.run !== "function") {
      throw new Error("SkillRunnerOpenClawExecutor requires runner.run()");
    }
    this.runner = runner;
  }

  async execute(task, runtimeContext) {
    const skillName = String(task.taskType || "").trim();
    if (!skillName) {
      return {
        status: "failed",
        error: {
          code: "skill_name_required",
          message: "OpenClaw skill execution requires taskType to contain a skill name",
          retryable: false,
        },
      };
    }

    const input =
      task.input && typeof task.input === "object" && !Array.isArray(task.input)
        ? {
            ...task.input,
            _runtime: {
              providerId: runtimeContext.runtimeProviderId,
              sessionId: runtimeContext.sessionId,
              orgId: runtimeContext.orgId,
              workerId: runtimeContext.workerId,
              allowedCapabilities: [...runtimeContext.allowedCapabilities],
              projectedTools: runtimeContext.projectedTools.map((tool) => tool.name),
              memoryScope: runtimeContext.memoryScope,
            },
          }
        : task.input;

    const output = await this.runner.run(skillName, input);
    return {
      status: "completed",
      output,
    };
  }
}

module.exports = {
  SkillRunnerOpenClawExecutor,
};
