import {
  AgentImprovementProfile,
  AgentPerformanceOutcome,
  ReflectionEvaluation,
  ReflectionInsight,
  ReflectionLoopEngine,
  ReflectionLoopOptions,
  ReflectionRecommendedAction,
  ReflectionTrend
} from "../interfaces/reflection-loop.js";

export class InMemoryReflectionLoopEngine implements ReflectionLoopEngine {
  private readonly outcomes = new Map<string, AgentPerformanceOutcome[]>();
  private readonly profiles = new Map<string, AgentImprovementProfile>();
  private readonly options: Required<ReflectionLoopOptions>;

  constructor(options: ReflectionLoopOptions = {}) {
    this.options = {
      windowSize: options.windowSize ?? 6,
      targetScore: options.targetScore ?? 0.75,
      targetSuccessRate: options.targetSuccessRate ?? 0.9,
      targetLatencyMs: options.targetLatencyMs ?? 5000
    };
  }

  recordOutcome(outcome: AgentPerformanceOutcome): ReflectionEvaluation {
    const normalized = normalizeOutcome(outcome);
    const current = this.outcomes.get(normalized.agentId) ?? [];
    this.outcomes.set(normalized.agentId, [...current, normalized]);
    this.updateProfile(normalized);
    return this.evaluateAgent(normalized.agentId);
  }

  evaluateAgent(agentId: string): ReflectionEvaluation {
    const timeline = this.outcomes.get(agentId) ?? [];
    const windowSize = this.options.windowSize;
    const currentWindow = timeline.slice(-windowSize);
    const previousWindow = timeline.slice(-(windowSize * 2), -windowSize);

    const currentAverageScore = average(currentWindow.map((outcome) => outcome.score));
    const previousAverageScore =
      previousWindow.length > 0
        ? average(previousWindow.map((outcome) => outcome.score))
        : undefined;
    const successRate = average(
      currentWindow.map((outcome) => (outcome.success ? 1 : 0))
    );
    const averageLatencyMs = average(
      currentWindow.map((outcome) => outcome.latencyMs ?? this.options.targetLatencyMs)
    );
    const trend = deriveTrend(currentAverageScore, previousAverageScore);
    const insights = buildInsights({
      currentAverageScore,
      successRate,
      averageLatencyMs,
      trend,
      options: this.options
    });
    const profile = this.getProfile(agentId);
    const recommendedActions = buildRecommendedActions(insights, profile);

    return {
      agentId,
      evaluatedAt: new Date().toISOString(),
      windowSize,
      currentAverageScore,
      previousAverageScore,
      successRate,
      averageLatencyMs,
      trend,
      insights,
      recommendedActions,
      profile
    };
  }

  listOutcomes(agentId: string): AgentPerformanceOutcome[] {
    return [...(this.outcomes.get(agentId) ?? [])];
  }

  getProfile(agentId: string): AgentImprovementProfile {
    const existing = this.profiles.get(agentId);
    if (existing) {
      return existing;
    }
    const created: AgentImprovementProfile = {
      agentId,
      strategyWeights: {},
      lastUpdatedAt: new Date().toISOString()
    };
    this.profiles.set(agentId, created);
    return created;
  }

  private updateProfile(outcome: AgentPerformanceOutcome): void {
    const profile = this.getProfile(outcome.agentId);
    const delta = outcome.score >= this.options.targetScore ? 0.05 : -0.05;
    for (const strategy of outcome.appliedStrategies ?? []) {
      const current = profile.strategyWeights[strategy] ?? 1;
      profile.strategyWeights[strategy] = clamp(current + delta, 0.1, 2);
    }
    profile.lastUpdatedAt = new Date().toISOString();
    this.profiles.set(profile.agentId, profile);
  }
}

function normalizeOutcome(outcome: AgentPerformanceOutcome): AgentPerformanceOutcome {
  return {
    ...outcome,
    timestamp: outcome.timestamp ?? new Date().toISOString(),
    score: clamp(outcome.score, 0, 1)
  };
}

function deriveTrend(
  currentAverage: number,
  previousAverage?: number
): ReflectionTrend {
  if (previousAverage === undefined) {
    return "insufficient_data";
  }
  const delta = currentAverage - previousAverage;
  if (delta >= 0.05) {
    return "improving";
  }
  if (delta <= -0.05) {
    return "declining";
  }
  return "stable";
}

function buildInsights(input: {
  currentAverageScore: number;
  successRate: number;
  averageLatencyMs: number;
  trend: ReflectionTrend;
  options: Required<ReflectionLoopOptions>;
}): ReflectionInsight[] {
  const insights: ReflectionInsight[] = [];
  if (input.currentAverageScore < input.options.targetScore) {
    insights.push({
      type: "quality",
      severity: "high",
      message: "Average quality score is below target."
    });
  }
  if (input.successRate < input.options.targetSuccessRate) {
    insights.push({
      type: "reliability",
      severity: "high",
      message: "Success rate is below target."
    });
  }
  if (input.averageLatencyMs > input.options.targetLatencyMs) {
    insights.push({
      type: "latency",
      severity: "medium",
      message: "Average latency exceeds target."
    });
  }
  if (input.trend === "declining") {
    insights.push({
      type: "trend",
      severity: "high",
      message: "Performance trend is declining compared to the previous window."
    });
  } else if (input.trend === "improving") {
    insights.push({
      type: "trend",
      severity: "low",
      message: "Performance trend is improving."
    });
  }
  return insights;
}

function buildRecommendedActions(
  insights: ReflectionInsight[],
  profile: AgentImprovementProfile
): ReflectionRecommendedAction[] {
  const actions: ReflectionRecommendedAction[] = [];
  for (const insight of insights) {
    switch (insight.type) {
      case "quality":
        actions.push({
          actionId: "strengthen-self-critique",
          description: "Increase internal critique depth before final outputs.",
          rationale: insight.message,
          priority: "high"
        });
        break;
      case "reliability":
        actions.push({
          actionId: "add-validation-step",
          description: "Add explicit validation and fallback checks for critical tasks.",
          rationale: insight.message,
          priority: "high"
        });
        break;
      case "latency":
        actions.push({
          actionId: "optimize-tool-path",
          description: "Reduce expensive tool invocations and streamline tool selection.",
          rationale: insight.message,
          priority: "medium"
        });
        break;
      case "trend":
        if (insight.severity === "high") {
          actions.push({
            actionId: "run-retrospective",
            description: "Trigger an agent retrospective to inspect recent regressions.",
            rationale: insight.message,
            priority: "high"
          });
        }
        break;
      case "strategy":
        break;
    }
  }

  const strongestStrategy = Object.entries(profile.strategyWeights).sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (strongestStrategy) {
    actions.push({
      actionId: "prioritize-top-strategy",
      description: `Prioritize strategy "${strongestStrategy[0]}" in upcoming tasks.`,
      rationale: "Historical outcomes show this strategy is currently strongest.",
      priority: "low"
    });
  }

  return dedupeActions(actions);
}

function dedupeActions(
  actions: ReflectionRecommendedAction[]
): ReflectionRecommendedAction[] {
  const seen = new Set<string>();
  const unique: ReflectionRecommendedAction[] = [];
  for (const action of actions) {
    if (seen.has(action.actionId)) {
      continue;
    }
    seen.add(action.actionId);
    unique.push(action);
  }
  return unique;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
