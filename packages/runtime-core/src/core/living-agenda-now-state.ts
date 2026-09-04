import type { LivingAgendaNowState, NowStateCandidate } from "../interfaces/living-agenda-life-map.js";

export function resolveLivingAgendaNowState(
  candidates: NowStateCandidate[],
  generatedAt = new Date().toISOString()
): LivingAgendaNowState {
  const eligible = candidates
    .filter((candidate) => candidate.availableNow && !candidate.blocked && !candidate.protectedConflict)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.estimatedMinutes - b.estimatedMinutes);

  const current = eligible[0];
  const next = eligible[1];
  const alternatives = eligible.slice(2, 5);

  const explanation: string[] = [];
  if (current) {
    explanation.push(`Do "${current.title}" now because it is the highest-priority eligible item.`);
    if (current.lifeMapPath?.explanation?.length) {
      explanation.push(...current.lifeMapPath.explanation.slice(0, 2));
    }
    if (current.reasons?.length) explanation.push(...current.reasons.slice(0, 2));
  } else {
    explanation.push("No executable item is currently eligible; the agenda should wait, recover, or reconcile.");
  }

  return { generatedAt, current, next, alternatives, explanation };
}
