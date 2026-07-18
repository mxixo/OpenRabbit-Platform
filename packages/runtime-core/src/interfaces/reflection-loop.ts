export interface AgentPerformanceOutcome {
  agentId: string;
  timestamp?: string;
  taskId?: string;
  success: boolean;
  score: number;
  latencyMs?: number;
  feedback?: string;
  errorCategory?: string;
  appliedStrategies?: string[];
}

export interface ReflectionInsight {
  type:
    | "quality"
    | "reliability"
    | "latency"
    | "trend"
    | "strategy";
  severity: "low" | "medium" | "high";
  message: string;
}

export interface ReflectionRecommendedAction {
  actionId: string;
  description: string;
  rationale: string;
  priority: "low" | "medium" | "high";
}

export interface AgentImprovementProfile {
  agentId: string;
  strategyWeights: Record<string, number>;
  lastUpdatedAt: string;
}

export type ReflectionTrend =
  | "improving"
  | "declining"
  | "stable"
  | "insufficient_data";

export interface ReflectionEvaluation {
  agentId: string;
  evaluatedAt: string;
  windowSize: number;
  currentAverageScore: number;
  previousAverageScore?: number;
  successRate: number;
  averageLatencyMs: number;
  trend: ReflectionTrend;
  insights: ReflectionInsight[];
  recommendedActions: ReflectionRecommendedAction[];
  profile: AgentImprovementProfile;
}

export interface ReflectionLoopOptions {
  windowSize?: number;
  targetScore?: number;
  targetSuccessRate?: number;
  targetLatencyMs?: number;
}

export interface ReflectionLoopEngine {
  recordOutcome(outcome: AgentPerformanceOutcome): ReflectionEvaluation;
  evaluateAgent(agentId: string): ReflectionEvaluation;
  listOutcomes(agentId: string): AgentPerformanceOutcome[];
  getProfile(agentId: string): AgentImprovementProfile;
}
