import type { LivingAgendaPreference, ProtectedTimePreference } from "./living-agenda-preferences.js";

export type CapacityBlockKind = "fixed_commitment" | "protected" | "recovery" | "focus" | "flexible";

export interface CapacityBlock {
  id: string;
  startAt: string;
  endAt: string;
  kind: CapacityBlockKind;
  label?: string;
  sourcePreferenceId?: string;
  refillPolicy?: ProtectedTimePreference["refillPolicy"];
}

export interface DailyCapacityInput {
  dayStartAt: string;
  dayEndAt: string;
  commitments: CapacityBlock[];
  protectedTimePreferences?: LivingAgendaPreference<ProtectedTimePreference>[];
  explicitAvailableMinutes?: number;
  reserveMinutes?: number;
}

export interface DailyCapacityAssessment {
  totalWindowMinutes: number;
  fixedMinutes: number;
  protectedMinutes: number;
  recoveryMinutes: number;
  flexibleMinutes: number;
  schedulableMinutes: number;
  refillableMinutes: number;
  blocks: CapacityBlock[];
  warnings: string[];
}
