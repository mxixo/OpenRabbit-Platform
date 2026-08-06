/**
 * Capability layer contracts (Layer 4).
 *
 * Capabilities are installable business modules (CRM, email, real-estate, …).
 * They extend OpenRabbit Core; they do not fork it.
 */

export interface ToolContribution {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags?: string[];
}

export interface WorkflowContribution {
  id: string;
  version?: string;
  name: string;
  description?: string;
  /** Optional template/path reference resolved by the workflows façade. */
  templateRef?: string;
  tags?: string[];
}

export interface PermissionContribution {
  action: string;
  resource: string;
  effect?: "allow" | "deny";
  description?: string;
}

/**
 * UI contribution descriptors for CX apps.
 * Core stores/forwards these; it does not render them.
 */
export interface UiContribution {
  id: string;
  surface: "web" | "mobile" | "ceo-dashboard" | "client-portal" | string;
  kind: "nav" | "page" | "widget" | "action" | string;
  title: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Installable capability module manifest.
 */
export interface CapabilityModuleManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  tools?: ToolContribution[];
  workflows?: WorkflowContribution[];
  knowledgeSchemas?: string[];
  permissions?: PermissionContribution[];
  /** Integration adapter ids required for full functionality. */
  integrations?: string[];
  uiContributions?: UiContribution[];
  /** Other capability ids that must be installed first. */
  dependsOnCapabilities?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type CapabilityInstallStatus =
  | "installed"
  | "enabled"
  | "disabled"
  | "failed";

/**
 * Org-scoped installation record for a capability module.
 */
export interface CapabilityInstallation {
  orgId: string;
  capabilityId: string;
  version: string;
  status: CapabilityInstallStatus;
  installedAt: string;
  updatedAt: string;
  error?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Global catalog of available capability modules (deployment-level).
 */
export interface CapabilityCatalog {
  register(manifest: CapabilityModuleManifest): void;
  unregister(capabilityId: string): void;
  get(capabilityId: string): CapabilityModuleManifest | undefined;
  list(filter?: { tag?: string }): CapabilityModuleManifest[];
}

export interface CapabilityInstallRequest {
  orgId: string;
  capabilityId: string;
  /** Defaults to catalog version when omitted. */
  version?: string;
  /** When true (default), installation ends in enabled state. */
  enable?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Org-scoped capability lifecycle manager.
 */
export interface CapabilityManager {
  install(request: CapabilityInstallRequest): CapabilityInstallation;
  enable(orgId: string, capabilityId: string): CapabilityInstallation;
  disable(orgId: string, capabilityId: string): CapabilityInstallation;
  uninstall(orgId: string, capabilityId: string): void;
  getInstallation(
    orgId: string,
    capabilityId: string
  ): CapabilityInstallation | undefined;
  listInstallations(
    orgId: string,
    filter?: { status?: CapabilityInstallStatus }
  ): CapabilityInstallation[];
  /**
   * Capability ids currently enabled for the org (for worker allow-lists, etc.).
   */
  listEnabledCapabilityIds(orgId: string): string[];
  /**
   * True when the capability is installed and enabled for the org.
   */
  isEnabled(orgId: string, capabilityId: string): boolean;
}
