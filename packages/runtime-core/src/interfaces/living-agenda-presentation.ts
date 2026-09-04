import type { LivingAgendaNowState } from "./living-agenda-life-map.js";

export type LivingAgendaSurface =
  | "mobile_app"
  | "lock_screen"
  | "live_activity"
  | "watch"
  | "voice"
  | "widget";

export type QuickActionKind =
  | "complete"
  | "not_complete"
  | "blocked"
  | "running_late"
  | "why"
  | "undo"
  | "open_app";

export interface LivingAgendaQuickAction {
  id: string;
  kind: QuickActionKind;
  label: string;
  requiresAppOpen: boolean;
}

export interface LivingAgendaNowPresentation {
  surface: LivingAgendaSurface;
  headline: string;
  primaryText: string;
  secondaryText?: string;
  currentPlanItemId?: string;
  nextPlanItemId?: string;
  whySummary?: string;
  actions: LivingAgendaQuickAction[];
  generatedAt: string;
  expiresAt?: string;
}

export interface LivingAgendaPresentationPolicy {
  maxActions: number;
  showWhySummary: boolean;
  allowSensitiveDetails: boolean;
}

export interface LivingAgendaNowPresenter {
  present(
    state: LivingAgendaNowState,
    surface: LivingAgendaSurface,
    policy?: Partial<LivingAgendaPresentationPolicy>,
  ): LivingAgendaNowPresentation;
}
