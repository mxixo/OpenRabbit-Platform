export type PreferenceProvenance =
  | "user_explicit"
  | "user_confirmed"
  | "system_observed"
  | "ai_inferred";

export type PreferenceStrength = "hard_boundary" | "strong" | "soft";

export interface LivingAgendaPreference<T = unknown> {
  id: string;
  userId: string;
  key: string;
  value: T;
  provenance: PreferenceProvenance;
  strength: PreferenceStrength;
  confidence: number;
  observedAt: string;
  confirmedAt?: string;
  expiresAt?: string;
  sourceSignalIds?: string[];
  supersedesPreferenceId?: string;
}

export interface OperatingPosture {
  pace: number;
  structure: number;
  accountability: number;
  timeFreedom: number;
  adaptability: number;
  growthPressure: number;
}

export interface ProtectedTimePreference {
  label: string;
  daysOfWeek?: number[];
  startLocalTime?: string;
  endLocalTime?: string;
  category?: "family" | "health" | "rest" | "recreation" | "focus" | "personal" | "other";
  refillPolicy: "never_auto_refill" | "ask_before_refill" | "flexible";
}

export interface PreferenceResolution<T = unknown> {
  effective?: LivingAgendaPreference<T>;
  conflicting: LivingAgendaPreference<T>[];
  requiresConfirmation: boolean;
  reason: string;
}
