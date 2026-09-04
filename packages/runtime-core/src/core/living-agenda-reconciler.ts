import type { AgendaCandidate, GeneratedLivingAgenda } from "./living-agenda-generator.js";
import { generateLivingAgenda } from "./living-agenda-generator.js";

export type AgendaChangeKind = "completed" | "blocked" | "skipped" | "added" | "capacity_changed";

export interface AgendaChange {
  kind: AgendaChangeKind;
  itemId?: string;
  detail?: string;
}

export interface ReconcileLivingAgendaInput {
  date: string;
  availableMinutes: number;
  candidates: AgendaCandidate[];
  changes: AgendaChange[];
}

export interface ReconciledLivingAgenda {
  agenda: GeneratedLivingAgenda;
  changes: AgendaChange[];
  coachNotes: string[];
}

export function reconcileLivingAgenda(input: ReconcileLivingAgendaInput): ReconciledLivingAgenda {
  const completedOrSkipped = new Set(
    input.changes
      .filter((change) => change.kind === "completed" || change.kind === "skipped")
      .map((change) => change.itemId)
      .filter((id): id is string => Boolean(id))
  );
  const blocked = new Set(
    input.changes
      .filter((change) => change.kind === "blocked")
      .map((change) => change.itemId)
      .filter((id): id is string => Boolean(id))
  );

  const remaining = input.candidates.filter(
    (candidate) => !completedOrSkipped.has(candidate.item.id) && !blocked.has(candidate.item.id)
  );
  const agenda = generateLivingAgenda({
    date: input.date,
    availableMinutes: input.availableMinutes,
    candidates: remaining
  });

  const coachNotes: string[] = [];
  const completed = input.changes.filter((change) => change.kind === "completed").length;
  const skipped = input.changes.filter((change) => change.kind === "skipped").length;
  const blockedCount = input.changes.filter((change) => change.kind === "blocked").length;
  const added = input.changes.filter((change) => change.kind === "added").length;

  if (completed) coachNotes.push(`${completed} completed item${completed === 1 ? "" : "s"} removed from the remaining agenda.`);
  if (blockedCount) coachNotes.push(`${blockedCount} blocked item${blockedCount === 1 ? "" : "s"} moved out of the executable agenda until the blocker clears.`);
  if (added) coachNotes.push(`${added} new item${added === 1 ? "" : "s"} considered against the remaining priorities.`);
  if (skipped) coachNotes.push(`${skipped} skipped item${skipped === 1 ? "" : "s"} should be reviewed for recommitment, delegation, or deprioritization.`);
  if (!coachNotes.length) coachNotes.push("No material execution changes; the remaining agenda was revalidated.");

  return { agenda, changes: [...input.changes], coachNotes };
}
