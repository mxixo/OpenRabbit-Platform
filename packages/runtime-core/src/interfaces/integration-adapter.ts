/**
 * Integration layer contracts (Layer 5).
 *
 * Integrations connect external systems (MCP, REST, GraphQL, webhooks, OAuth).
 * MCP is one kind — not the product identity.
 */

export type IntegrationKind =
  | "mcp"
  | "rest"
  | "graphql"
  | "webhook"
  | "oauth"
  | "custom"
  | string;

export interface IntegrationConfig {
  /** Opaque connector configuration (endpoints, scopes, non-secret flags). */
  settings?: Record<string, unknown>;
  /** Secret references — never raw secrets in manifests when possible. */
  secretRefs?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface IntegrationHandle {
  id: string;
  adapterId: string;
  kind: IntegrationKind;
  connectedAt: string;
  metadata?: Record<string, unknown>;
}

export type IntegrationHealthStatus = "up" | "down" | "degraded" | "unknown";

export interface IntegrationHealth {
  status: IntegrationHealthStatus;
  checkedAt: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Connector adapter for an external system family.
 */
export interface IntegrationAdapter {
  readonly id: string;
  readonly kind: IntegrationKind;
  readonly displayName?: string;

  connect(config: IntegrationConfig): Promise<IntegrationHandle>;
  health(handle: IntegrationHandle): Promise<IntegrationHealth>;
  disconnect(handle: IntegrationHandle): Promise<void>;
}

/**
 * Registry of integration adapters available in a deployment.
 */
export interface IntegrationAdapterRegistry {
  register(adapter: IntegrationAdapter): void;
  unregister(adapterId: string): void;
  get(adapterId: string): IntegrationAdapter | undefined;
  list(filter?: { kind?: IntegrationKind }): IntegrationAdapter[];
}
