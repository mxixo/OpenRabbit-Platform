import type {
  LivingAgendaSignal,
  LivingAgendaSignalStore,
  SignalFilter
} from "../interfaces/signals.js";

function cloneSignal<TPayload>(signal: LivingAgendaSignal<TPayload>): LivingAgendaSignal<TPayload> {
  return {
    ...signal,
    payload:
      signal.payload && typeof signal.payload === "object"
        ? ({ ...(signal.payload as Record<string, unknown>) } as TPayload)
        : signal.payload,
    metadata: signal.metadata ? { ...signal.metadata } : undefined
  };
}

export class InMemoryLivingAgendaSignalStore implements LivingAgendaSignalStore {
  private readonly signals = new Map<string, LivingAgendaSignal>();

  append<TPayload>(signal: LivingAgendaSignal<TPayload>): LivingAgendaSignal<TPayload> {
    if (!signal.id?.trim()) throw new Error("signal id is required");
    if (!signal.userId?.trim()) throw new Error("signal userId is required");
    if (!signal.type?.trim()) throw new Error("signal type is required");
    if (!signal.source?.trim()) throw new Error("signal source is required");
    if (signal.confidence < 0 || signal.confidence > 1) {
      throw new Error("signal confidence must be between 0 and 1");
    }
    const key = this.key(signal.userId, signal.id);
    if (this.signals.has(key)) throw new Error(`Signal already exists: ${signal.id}`);
    const cloned = cloneSignal(signal);
    this.signals.set(key, cloned);
    return cloneSignal(cloned);
  }

  get(userId: string, signalId: string): LivingAgendaSignal | undefined {
    const signal = this.signals.get(this.key(userId, signalId));
    return signal ? cloneSignal(signal) : undefined;
  }

  list(userId: string, filter?: SignalFilter): LivingAgendaSignal[] {
    return [...this.signals.values()]
      .filter((signal) => {
        if (signal.userId !== userId) return false;
        if (filter?.type && signal.type !== filter.type) return false;
        if (filter?.provenance && signal.provenance !== filter.provenance) return false;
        if (filter?.source && signal.source !== filter.source) return false;
        if (!filter?.includeQuarantined && signal.quarantined) return false;
        return true;
      })
      .map(cloneSignal);
  }

  quarantine(userId: string, signalId: string): LivingAgendaSignal {
    const key = this.key(userId, signalId);
    const current = this.signals.get(key);
    if (!current) throw new Error(`Signal not found: ${signalId}`);
    const next = { ...current, quarantined: true };
    this.signals.set(key, next);
    return cloneSignal(next);
  }

  correct<TPayload>(
    userId: string,
    signalId: string,
    replacement: LivingAgendaSignal<TPayload>
  ): LivingAgendaSignal<TPayload> {
    const original = this.signals.get(this.key(userId, signalId));
    if (!original) throw new Error(`Signal not found: ${signalId}`);
    if (replacement.userId !== userId) throw new Error("replacement userId must match original userId");
    if (!replacement.correctionOf) replacement = { ...replacement, correctionOf: signalId };
    this.quarantine(userId, signalId);
    return this.append(replacement);
  }

  private key(userId: string, signalId: string): string {
    return `${userId}:${signalId}`;
  }
}
