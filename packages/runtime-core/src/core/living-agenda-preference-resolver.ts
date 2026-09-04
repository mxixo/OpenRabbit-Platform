import type {
  LivingAgendaPreference,
  PreferenceResolution
} from "../interfaces/living-agenda-preferences.js";

const provenanceWeight = {
  user_explicit: 4,
  user_confirmed: 3,
  system_observed: 2,
  ai_inferred: 1
} as const;

const strengthWeight = {
  hard_boundary: 3,
  strong: 2,
  soft: 1
} as const;

function isActive(preference: LivingAgendaPreference, now: string): boolean {
  return !preference.expiresAt || preference.expiresAt > now;
}

export function resolveLivingAgendaPreference<T>(
  preferences: LivingAgendaPreference<T>[],
  now = new Date().toISOString()
): PreferenceResolution<T> {
  const active = preferences.filter((preference) => isActive(preference, now));
  if (!active.length) {
    return {
      conflicting: [],
      requiresConfirmation: false,
      reason: "No active preference is available."
    };
  }

  const sorted = [...active].sort((a, b) => {
    const strength = strengthWeight[b.strength] - strengthWeight[a.strength];
    if (strength) return strength;
    const provenance = provenanceWeight[b.provenance] - provenanceWeight[a.provenance];
    if (provenance) return provenance;
    const confidence = b.confidence - a.confidence;
    if (confidence) return confidence;
    return b.observedAt.localeCompare(a.observedAt);
  });

  const effective = sorted[0];
  const conflicting = sorted.slice(1).filter(
    (preference) => JSON.stringify(preference.value) !== JSON.stringify(effective.value)
  );

  const strongConflict = conflicting.some(
    (preference) =>
      preference.strength === "hard_boundary" ||
      preference.provenance === "user_explicit" ||
      preference.provenance === "user_confirmed"
  );

  return {
    effective,
    conflicting,
    requiresConfirmation: strongConflict,
    reason: strongConflict
      ? "A meaningful preference conflict exists; preserve the strongest known boundary and ask before overriding it."
      : "Resolved using preference strength, provenance, confidence, and recency."
  };
}
