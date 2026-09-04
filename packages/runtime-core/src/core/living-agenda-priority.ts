import type { ExplainablePriorityScore, PriorityFactors } from "../interfaces/goals.js";

export interface PriorityScoreInput {
  goalAlignment?: number;
  urgency?: number;
  impact?: number;
  dependencyPressure?: number;
  commitmentPressure?: number;
  effortFit?: number;
  staleness?: number;
}

const WEIGHTS: Record<keyof PriorityFactors, number> = {
  goalAlignment: 0.26,
  urgency: 0.2,
  impact: 0.2,
  dependencyPressure: 0.12,
  commitmentPressure: 0.1,
  effortFit: 0.07,
  staleness: 0.05
};

function normalized(value?: number): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function scoreLivingAgendaPriority(input: PriorityScoreInput): ExplainablePriorityScore {
  const factors: PriorityFactors = {
    goalAlignment: normalized(input.goalAlignment),
    urgency: normalized(input.urgency),
    impact: normalized(input.impact),
    dependencyPressure: normalized(input.dependencyPressure),
    commitmentPressure: normalized(input.commitmentPressure),
    effortFit: normalized(input.effortFit),
    staleness: normalized(input.staleness)
  };

  const score = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof PriorityFactors>).reduce(
      (total, key) => total + factors[key] * WEIGHTS[key],
      0
    )
  );

  const reasons = (Object.keys(factors) as Array<keyof PriorityFactors>)
    .filter((key) => factors[key] >= 70)
    .sort((a, b) => factors[b] * WEIGHTS[b] - factors[a] * WEIGHTS[a])
    .slice(0, 3)
    .map((key) => `${key}: ${factors[key]}/100`);

  return { score, factors, reasons };
}
