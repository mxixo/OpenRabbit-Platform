export interface EventEnvelope<TPayload = unknown> {
  type: string;
  payload: TPayload;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type EventHandler<TPayload = unknown> = (
  event: EventEnvelope<TPayload>
) => void | Promise<void>;

export interface PublishResult {
  delivered: number;
  failed: number;
  errors: Error[];
}

export interface EventBus {
  subscribe<TPayload = unknown>(
    eventType: string,
    handler: EventHandler<TPayload>
  ): () => void;
  publish<TPayload = unknown>(
    event: EventEnvelope<TPayload>
  ): Promise<PublishResult>;
}
