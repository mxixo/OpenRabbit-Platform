/**
 * Industry pack contracts.
 *
 * Packs compose capabilities + integrations + worker presets.
 * They extend the platform; they must not contain a second core.
 */

import type { WorkerDefinition, WorkerPreset } from "./worker.js";

export interface IndustryPackManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  /** Capability module ids included in the pack. */
  capabilities: string[];
  /** Integration adapter ids the pack expects. */
  integrations: string[];
  /** Worker presets materialized on install (optional). */
  workerPresets?: WorkerPreset[];
  /** Workflow ids/presets contributed or required. */
  workflowPresets?: string[];
  defaults?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type PackInstallStatus =
  | "installed"
  | "enabled"
  | "disabled"
  | "failed"
  | "partial";

export interface PackInstallation {
  orgId: string;
  packId: string;
  version: string;
  status: PackInstallStatus;
  installedAt: string;
  updatedAt: string;
  /** Capability ids successfully installed as part of this pack operation. */
  installedCapabilityIds: string[];
  /** Worker ids created from pack presets (if requested). */
  createdWorkerIds?: string[];
  error?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
}

export interface IndustryPackCatalog {
  register(manifest: IndustryPackManifest): void;
  unregister(packId: string): void;
  get(packId: string): IndustryPackManifest | undefined;
  list(filter?: { tag?: string }): IndustryPackManifest[];
}

export interface PackInstallRequest {
  orgId: string;
  packId: string;
  version?: string;
  /** Defaults to true — enable capabilities after install. */
  enable?: boolean;
  /**
   * When true, materialize worker presets into WorkerDefinitions.
   * Requires a worker materializer callback on the installer.
   */
  materializeWorkers?: boolean;
  /** Optional id prefix for created workers (default: packId). */
  workerIdPrefix?: string;
  metadata?: Record<string, unknown>;
}

export interface PackInstallResult {
  installation: PackInstallation;
  workers?: WorkerDefinition[];
}

/**
 * Installs industry packs onto an org by composing capability installs
 * and optional worker preset materialization.
 */
export interface IndustryPackInstaller {
  install(request: PackInstallRequest): PackInstallResult;
  enable(orgId: string, packId: string): PackInstallation;
  disable(orgId: string, packId: string): PackInstallation;
  uninstall(orgId: string, packId: string): void;
  getInstallation(orgId: string, packId: string): PackInstallation | undefined;
  listInstallations(
    orgId: string,
    filter?: { status?: PackInstallStatus }
  ): PackInstallation[];
  isEnabled(orgId: string, packId: string): boolean;
}
