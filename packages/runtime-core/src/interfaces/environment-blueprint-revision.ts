import type { EnvironmentBlueprint } from "./environment-blueprint.js";

export interface EnvironmentBlueprintRevisionRecord {
  protocol: "environment_blueprint_revision_v1";
  orgId: string;
  revision: string;
  generatedAt: string;
  blueprint: EnvironmentBlueprint;
  previousRecordHash?: string;
  recordHash: string;
}

export interface EnvironmentBlueprintRevisionStore {
  append(record: EnvironmentBlueprintRevisionRecord): void;
  getLatest(orgId: string): EnvironmentBlueprintRevisionRecord | undefined;
  getRevision(
    orgId: string,
    revision: string,
  ): EnvironmentBlueprintRevisionRecord | undefined;
  listRevisions(orgId: string): EnvironmentBlueprintRevisionRecord[];
}
