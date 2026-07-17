import {
  EventBus,
  EventEnvelope,
  EventHandler,
  PublishResult
} from "../interfaces/event-bus.js";

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  subscribe<TPayload = unknown>(
    eventType: string,
    handler: EventHandler<TPayload>
  ): () => void {
    const set = this.handlers.get(eventType) ?? new Set<EventHandler<unknown>>();
    set.add(handler as EventHandler<unknown>);
    this.handlers.set(eventType, set);

    return () => {
      const current = this.handlers.get(eventType);
      current?.delete(handler as EventHandler<unknown>);
      if (current && current.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  async publish<TPayload = unknown>(
    event: EventEnvelope<TPayload>
  ): Promise<PublishResult> {
    const handlers = [...(this.handlers.get(event.type) ?? [])];
    let delivered = 0;
    const errors: Error[] = [];

    for (const handler of handlers) {
      try {
        await handler(event);
        delivered += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return {
      delivered,
      failed: errors.length,
      errors
    };
  }
}
