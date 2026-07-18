import { describe, expect, it } from "vitest";
import { InMemoryReflectionLoopEngine } from "../../src/core/in-memory-reflection-loop-engine.js";

describe("InMemoryReflectionLoopEngine", () => {
  it("evaluates outcomes and reports improving trend over time", () => {
    const engine = new InMemoryReflectionLoopEngine({ windowSize: 3 });

    engine.recordOutcome({
      agentId: "agent-a",
      success: false,
      score: 0.4,
      latencyMs: 7000
    });
    engine.recordOutcome({
      agentId: "agent-a",
      success: true,
      score: 0.5,
      latencyMs: 6500
    });
    engine.recordOutcome({
      agentId: "agent-a",
      success: true,
      score: 0.55,
      latencyMs: 6000
    });
    engine.recordOutcome({
      agentId: "agent-a",
      success: true,
      score: 0.8,
      latencyMs: 4500
    });
    engine.recordOutcome({
      agentId: "agent-a",
      success: true,
      score: 0.85,
      latencyMs: 4300
    });
    const evaluation = engine.recordOutcome({
      agentId: "agent-a",
      success: true,
      score: 0.9,
      latencyMs: 4000
    });

    expect(evaluation.trend).toBe("improving");
    expect(evaluation.currentAverageScore).toBeGreaterThan(0.8);
    expect(evaluation.previousAverageScore).toBeLessThan(0.6);
  });

  it("produces improvement actions for underperforming agents", () => {
    const engine = new InMemoryReflectionLoopEngine({
      windowSize: 3,
      targetScore: 0.8,
      targetSuccessRate: 0.95,
      targetLatencyMs: 3000
    });

    engine.recordOutcome({
      agentId: "agent-b",
      success: false,
      score: 0.45,
      latencyMs: 9000
    });
    engine.recordOutcome({
      agentId: "agent-b",
      success: false,
      score: 0.5,
      latencyMs: 8000
    });
    const evaluation = engine.recordOutcome({
      agentId: "agent-b",
      success: true,
      score: 0.55,
      latencyMs: 7000
    });

    expect(evaluation.insights.map((insight) => insight.type)).toEqual(
      expect.arrayContaining(["quality", "reliability", "latency"])
    );
    expect(
      evaluation.recommendedActions.map((action) => action.actionId)
    ).toEqual(
      expect.arrayContaining([
        "strengthen-self-critique",
        "add-validation-step",
        "optimize-tool-path"
      ])
    );
  });

  it("adapts strategy weights based on historical outcomes", () => {
    const engine = new InMemoryReflectionLoopEngine({ targetScore: 0.7 });

    engine.recordOutcome({
      agentId: "agent-c",
      success: true,
      score: 0.9,
      appliedStrategies: ["few-shot-planning"]
    });
    engine.recordOutcome({
      agentId: "agent-c",
      success: true,
      score: 0.85,
      appliedStrategies: ["few-shot-planning"]
    });
    engine.recordOutcome({
      agentId: "agent-c",
      success: false,
      score: 0.4,
      appliedStrategies: ["tool-heavy"]
    });

    const profile = engine.getProfile("agent-c");
    expect(profile.strategyWeights["few-shot-planning"]).toBeGreaterThan(
      profile.strategyWeights["tool-heavy"] ?? 0
    );
    const evaluation = engine.evaluateAgent("agent-c");
    expect(
      evaluation.recommendedActions.find(
        (action) => action.actionId === "prioritize-top-strategy"
      )
    ).toBeDefined();
  });
});
