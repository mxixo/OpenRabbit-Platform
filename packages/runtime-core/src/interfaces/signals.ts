export type LivingAgendaSignalType =
  | "user_statement"
  | "calendar_commitment"
  | "calendar_change"
  | "execution_check_in"
  | "task_reflection"
  | "schedule_change"
  | "interruption"
  | "recovery"
  | "goal_update"
  | "health_wellness"
  | "wearable_interaction";

export type SignalProvenance =
  | "user_stated"
  | "user_action"
  | "provider_observed"
  | "device_observed"
  | "system_derived"
  | "ai_inferred";

export interface LivingAgendaSignal<TPayload = unknown> {
  id: string;
  userId: string;
  type: LivingAgendaSignalType;
  source: string;
  observedAt: string;
  receivedAt: string;
  confidence: number;
  provenance: SignalProvenance;
  permissionScope?: string;
  payload: TPayload;
  correctionOf?: string;
  expiresAt?: string;
  quarantined?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SignalFilter {
  type?: LivingAgendaSignalType;
  provenance?: SignalProvenance;
  source?: string;
  includeQuarantined?: boolean;
}

export interface LivingAgendaSignalStore {
  append<TPayload>(signal: LivingAgendaSignal<TPayload>): LivingAgendaSignal<TPayload>;
  get(userId: string, signalId: string): LivingAgendaSignal | undefined;
  list(userId: string, filter?: SignalFilter): LivingAgendaSignal[];
  quarantine(userId: string, signalId: string): LivingAgendaSignal;
  correct<TPayload>(
    userId: string,
    signalId: string,
    replacement: LivingAgendaSignal<TPayload>
  ): LivingAgendaSignal<TPayload>;
}
