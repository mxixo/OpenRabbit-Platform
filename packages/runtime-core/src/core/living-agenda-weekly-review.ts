import type {
  RecalibrationProposal,
  WeeklyExecutionSummary,
  WeeklyPattern,
  WeeklyRecalibration
} from "../interfaces/living-agenda-weekly-review.js";

export function buildWeeklyRecalibration(summary: WeeklyExecutionSummary): WeeklyRecalibration {
  const patterns: WeeklyPattern[] = [];
  const proposals: RecalibrationProposal[] = [];
  const adherence = summary.plannedMinutes > 0 ? summary.completedMinutes / summary.plannedMinutes : 1;

  if (summary.plannedMinutes > 0 && adherence < 0.65) {
    patterns.push({
      id: "overcommitment",
      kind: "overcommitment",
      observation: "Planned workload materially exceeded completed workload this week.",
      confidence: 0.9,
      evidence: [`${summary.completedMinutes}/${summary.plannedMinutes} planned minutes completed`]
    });
    proposals.push({
      id: "reduce-capacity",
      kind: "capacity",
      proposal: "Reduce next week's flexible planned capacity before adding more work.",
      rationale: "The current plan appears to be overestimating reliable capacity.",
      requiresUserConfirmation: true
    });
  }

  if (summary.skippedCount >= 3) {
    patterns.push({
      id: "repeated-skips",
      kind: "drift",
      observation: "Several planned items were skipped rather than completed or explicitly rescheduled.",
      confidence: 0.8,
      evidence: [`${summary.skippedCount} skipped items`]
    });
    proposals.push({
      id: "review-skips",
      kind: "planning",
      proposal: "Review repeatedly skipped work for recommitment, delegation, reduction, or removal.",
      rationale: "Repeatedly carrying work forward can hide goal drift or unrealistic planning.",
      requiresUserConfirmation: true
    });
  }

  const byTime = summary.byTimeOfDay ?? {};
  const ranked = Object.entries(byTime)
    .filter(([, value]) => value.planned > 0)
    .map(([label, value]) => ({ label, rate: value.completed / value.planned }))
    .sort((a, b) => b.rate - a.rate);

  if (ranked.length >= 2 && ranked[0]!.rate - ranked[ranked.length - 1]!.rate >= 0.25) {
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    patterns.push({
      id: "time-of-day",
      kind: "timing",
      observation: `Execution was materially stronger during ${best.label} than ${worst.label}.`,
      confidence: 0.75,
      evidence: [`${best.label}: ${Math.round(best.rate * 100)}%`, `${worst.label}: ${Math.round(worst.rate * 100)}%`]
    });
    proposals.push({
      id: "shift-strategic-work",
      kind: "timing",
      proposal: `Consider placing more important flexible work in ${best.label}.`,
      rationale: "Observed completion was stronger in that period this week.",
      requiresUserConfirmation: true
    });
  }

  const reflectionPrompts = [
    "What felt easier or harder than expected this week?",
    "Did the agenda protect what mattered outside work?",
    "Is there anything you want me to push harder on or back off from next week?"
  ];

  return { summary, patterns, proposals, reflectionPrompts };
}
