const assert = require("assert");
const {
  OpenClawRuntimeProvider,
  SkillRunnerOpenClawExecutor,
} = require("../runtimes/openclaw");

async function runTests() {
  const calls = [];
  const runner = {
    async run(skillName, input) {
      calls.push({ skillName, input });
      return { ok: true, skillName, input };
    },
  };

  const provider = new OpenClawRuntimeProvider({
    executor: new SkillRunnerOpenClawExecutor(runner),
  });

  const session = await provider.startSession({
    requestId: "req-1",
    orgId: "org-1",
    workerId: "worker-acq-1",
    projectedTools: [{ name: "deal.underwrite" }, { name: "crm.read" }],
    allowedCapabilities: ["real-estate", "crm"],
    memoryScope: "worker",
    metadata: { role: "acquisitions_analyst" },
  });

  assert.strictEqual(session.runtimeProviderId, "openclaw");
  assert.strictEqual(session.status, "ready");

  const tools = await provider.listProjectedTools(session.sessionId);
  assert.deepStrictEqual(
    tools.map((tool) => tool.name),
    ["deal.underwrite", "crm.read"]
  );

  const result = await provider.runTask({
    sessionId: session.sessionId,
    taskId: "task-1",
    taskType: "commercial_investment_workflow",
    input: { address: "100 Market St, Phoenix, AZ" },
  });

  assert.strictEqual(result.status, "completed");
  assert.strictEqual(result.output.ok, true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].skillName, "commercial_investment_workflow");
  assert.strictEqual(calls[0].input._runtime.providerId, "openclaw");
  assert.strictEqual(calls[0].input._runtime.workerId, "worker-acq-1");
  assert.deepStrictEqual(calls[0].input._runtime.allowedCapabilities, [
    "real-estate",
    "crm",
  ]);

  const readyAgain = await provider.getSession(session.sessionId);
  assert.strictEqual(readyAgain.status, "ready");

  await provider.stopSession(session.sessionId);
  const stopped = await provider.getSession(session.sessionId);
  assert.strictEqual(stopped.status, "stopped");

  const afterStop = await provider.runTask({
    sessionId: session.sessionId,
    taskId: "task-2",
    taskType: "commercial_investment_workflow",
    input: {},
  });
  assert.strictEqual(afterStop.status, "failed");
  assert.strictEqual(afterStop.error.code, "session_not_runnable");

  const throwingProvider = new OpenClawRuntimeProvider({
    executor: {
      async execute() {
        throw new Error("transport unavailable");
      },
    },
  });
  const errorSession = await throwingProvider.startSession({
    requestId: "req-2",
    orgId: "org-1",
    workerId: "worker-research-1",
  });
  const failed = await throwingProvider.runTask({
    sessionId: errorSession.sessionId,
    taskId: "task-3",
    taskType: "research.summary",
    input: {},
  });
  assert.strictEqual(failed.status, "failed");
  assert.strictEqual(failed.error.code, "openclaw_executor_error");
  assert.strictEqual(failed.error.retryable, true);

  console.log("OpenClaw RuntimeProvider tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
