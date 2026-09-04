import type { LivingAgendaSignal, SignalProvenance } from "../interfaces/signals.js";

export interface ExecutionCheckInSignalInput {
  id: string;
  userId: string;
  itemId: string;
  completed: boolean;
  observedAt: string;
  receivedAt?: string;
  modality: "voice" | "text" | "touch" | "swipe" | "watch";
  reportedCompletionAt?: string;
  source?: string;
  confidence?: number;
}

export interface TaskReflectionSignalInput {
  id: string;
  userId: string;
  itemId: string;
  note: string;
  observedAt: string;
  receivedAt?: string;
  modality: "voice" | "text" | "touch" | "watch";
  tags?: string[];
  source?: string;
}

function provenanceFor(modality: string): SignalProvenance {
  return modality === "watch" ? "user_action" : "user_stated";
}

export function executionCheckInToSignal(input: ExecutionCheckInSignalInput): LivingAgendaSignal {
  return {
    id: input.id,
    userId: input.userId,
    type: "execution_check_in",
    source: input.source ?? input.modality,
    observedAt: input.observedAt,
    receivedAt: input.receivedAt ?? input.observedAt,
    confidence: input.confidence ?? 1,
    provenance: "user_action",
    permissionScope: "personal_execution",
    payload: {
      itemId: input.itemId,
      completed: input.completed,
      modality: input.modality,
      reportedCompletionAt: input.reportedCompletionAt
    }
  };
}

export function taskReflectionToSignal(input: TaskReflectionSignalInput): LivingAgendaSignal {
  return {
    id: input.id,
    userId: input.userId,
    type: "task_reflection",
    source: input.source ?? input.modality,
    observedAt: input.observedAt,
    receivedAt: input.receivedAt ?? input.observedAt,
    confidence: 1,
    provenance: provenanceFor(input.modality),
    permissionScope: "personal_execution",
    payload: {
      itemId: input.itemId,
      note: input.note,
      modality: input.modality,
      tags: input.tags ? [...input.tags] : undefined
    }
  };
}
