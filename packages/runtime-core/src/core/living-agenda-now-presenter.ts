import type {
  LivingAgendaNowPresentation,
  LivingAgendaNowPresenter,
  LivingAgendaPresentationPolicy,
  LivingAgendaQuickAction,
  LivingAgendaSurface,
} from "../interfaces/living-agenda-presentation.js";
import type { LivingAgendaNowState } from "../interfaces/living-agenda-life-map.js";

const DEFAULT_POLICY: LivingAgendaPresentationPolicy = {
  maxActions: 4,
  showWhySummary: true,
  allowSensitiveDetails: false,
};

function actionsFor(state: LivingAgendaNowState): LivingAgendaQuickAction[] {
  if (!state.current) {
    return [{ id: "open", kind: "open_app", label: "Open Agenda", requiresAppOpen: true }];
  }

  return [
    { id: "done", kind: "complete", label: "Done", requiresAppOpen: false },
    { id: "late", kind: "running_late", label: "Running Late", requiresAppOpen: false },
    { id: "blocked", kind: "blocked", label: "Blocked", requiresAppOpen: false },
    { id: "why", kind: "why", label: "Why?", requiresAppOpen: false },
  ];
}

export class DefaultLivingAgendaNowPresenter implements LivingAgendaNowPresenter {
  present(
    state: LivingAgendaNowState,
    surface: LivingAgendaSurface,
    policyOverrides: Partial<LivingAgendaPresentationPolicy> = {},
  ): LivingAgendaNowPresentation {
    const policy = { ...DEFAULT_POLICY, ...policyOverrides };
    const generatedAt = new Date().toISOString();

    if (!state.current) {
      return {
        surface,
        headline: "NOW",
        primaryText: state.explanation[0] ?? "Nothing needs your attention right now.",
        actions: actionsFor(state).slice(0, policy.maxActions),
        generatedAt,
      };
    }

    const whySummary = policy.showWhySummary
      ? state.explanation[0]
      : undefined;

    return {
      surface,
      headline: "NOW",
      primaryText: state.current.title,
      secondaryText: state.next ? `Next: ${state.next.title}` : undefined,
      currentPlanItemId: state.current.itemId,
      nextPlanItemId: state.next?.itemId,
      whySummary,
      actions: actionsFor(state).slice(0, policy.maxActions),
      generatedAt,
    };
  }
}
