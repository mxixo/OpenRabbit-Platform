import type { CalendarPlanItem } from "../interfaces/calendar.js";
import type { ExplainablePriorityScore } from "../interfaces/goals.js";
import { scoreLivingAgendaPriority, type PriorityScoreInput } from "./living-agenda-priority.js";

export interface AgendaCandidate {
  item: CalendarPlanItem;
  estimatedMinutes: number;
  fixed?: boolean;
  priorityFactors?: PriorityScoreInput;
}

export interface AgendaScheduledItem {
  itemId: string;
  title: string;
  startAt?: string;
  endAt?: string;
  estimatedMinutes: number;
  fixed: boolean;
  priority: ExplainablePriorityScore;
}

export interface AgendaDeferredItem {
  itemId: string;
  title: string;
  reason: string;
  priority: ExplainablePriorityScore;
}

export interface GeneratedLivingAgenda {
  date: string;
  availableMinutes: number;
  scheduledMinutes: number;
  items: AgendaScheduledItem[];
  deferred: AgendaDeferredItem[];
  explanation: string[];
}

export interface GenerateLivingAgendaInput {
  date: string;
  availableMinutes: number;
  candidates: AgendaCandidate[];
}

export function generateLivingAgenda(input: GenerateLivingAgendaInput): GeneratedLivingAgenda {
  const scored = input.candidates.map((candidate) => ({
    ...candidate,
    priority: scoreLivingAgendaPriority(candidate.priorityFactors ?? {})
  }));

  const fixed = scored.filter((candidate) => candidate.fixed);
  const flexible = scored
    .filter((candidate) => !candidate.fixed)
    .sort((a, b) => b.priority.score - a.priority.score || a.estimatedMinutes - b.estimatedMinutes);

  const items: AgendaScheduledItem[] = [];
  const deferred: AgendaDeferredItem[] = [];
  let scheduledMinutes = 0;

  for (const candidate of fixed) {
    items.push({
      itemId: candidate.item.id,
      title: candidate.item.title,
      startAt: candidate.item.startAt,
      endAt: candidate.item.endAt,
      estimatedMinutes: candidate.estimatedMinutes,
      fixed: true,
      priority: candidate.priority
    });
    scheduledMinutes += candidate.estimatedMinutes;
  }

  let remaining = Math.max(0, input.availableMinutes - scheduledMinutes);
  for (const candidate of flexible) {
    if (candidate.estimatedMinutes <= remaining) {
      items.push({
        itemId: candidate.item.id,
        title: candidate.item.title,
        startAt: candidate.item.startAt,
        endAt: candidate.item.endAt,
        estimatedMinutes: candidate.estimatedMinutes,
        fixed: false,
        priority: candidate.priority
      });
      scheduledMinutes += candidate.estimatedMinutes;
      remaining -= candidate.estimatedMinutes;
    } else {
      deferred.push({
        itemId: candidate.item.id,
        title: candidate.item.title,
        reason: `Needs ${candidate.estimatedMinutes} minutes; ${remaining} available after higher-priority commitments`,
        priority: candidate.priority
      });
    }
  }

  const explanation = [
    `Protected ${fixed.length} fixed commitment${fixed.length === 1 ? "" : "s"}.`,
    `Scheduled ${items.length - fixed.length} flexible item${items.length - fixed.length === 1 ? "" : "s"} by explainable priority.`,
    deferred.length
      ? `Deferred ${deferred.length} item${deferred.length === 1 ? "" : "s"} that did not fit the remaining capacity.`
      : "All candidate work fit within the available capacity."
  ];

  return {
    date: input.date,
    availableMinutes: input.availableMinutes,
    scheduledMinutes,
    items,
    deferred,
    explanation
  };
}
