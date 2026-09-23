export type EnvironmentSurfaceId =
  | "calendar"
  | "communications"
  | "work"
  | "intelligence"
  | "social";

export type EnvironmentComponentState =
  | "enabled"
  | "disabled"
  | "connected"
  | "available"
  | "missing";

export interface EnvironmentSurface {
  id: EnvironmentSurfaceId;
  enabled: boolean;
  capabilityIds: string[];
  integrationIds: string[];
  workflowIds: string[];
}

export interface EnvironmentPackProjection {
  id: string;
  version: string;
  state: "enabled" | "disabled";
}

export interface EnvironmentCapabilityProjection {
  id: string;
  version: string;
  state: "enabled" | "disabled";
  surfaces: EnvironmentSurfaceId[];
}

export interface EnvironmentIntegrationProjection {
  id: string;
  state: "connected" | "available" | "missing";
}

export interface EnvironmentWorkerProjection {
  id: string;
  capabilityIds: string[];
}

export interface EnvironmentBlueprint {
  protocol: "environment_blueprint_v1";
  orgId: string;
  revision: string;
  generatedAt: string;
  packs: EnvironmentPackProjection[];
  capabilities: EnvironmentCapabilityProjection[];
  integrations: EnvironmentIntegrationProjection[];
  workers: EnvironmentWorkerProjection[];
  workflows: string[];
  approvalPolicyRef?: string;
  modelRoutingPolicyRef?: string;
  surfaces: EnvironmentSurface[];
}

export interface EnvironmentPackStateInput {
  orgId: string;
  id: string;
  version: string;
  enabled: boolean;
}

export interface EnvironmentCapabilityStateInput {
  orgId: string;
  id: string;
  version: string;
  enabled: boolean;
  surfaces?: EnvironmentSurfaceId[];
}

export interface EnvironmentIntegrationStateInput {
  orgId: string;
  id: string;
  state: "connected" | "available" | "missing";
}

export interface EnvironmentWorkerStateInput {
  orgId: string;
  id: string;
  capabilityIds?: string[];
}

export interface EnvironmentBlueprintInput {
  orgId: string;
  revision: string;
  generatedAt: string;
  packs?: EnvironmentPackStateInput[];
  capabilities?: EnvironmentCapabilityStateInput[];
  integrations?: EnvironmentIntegrationStateInput[];
  workers?: EnvironmentWorkerStateInput[];
  workflows?: string[];
  surfaceBindings?: Partial<
    Record<
      EnvironmentSurfaceId,
      {
        capabilityIds?: string[];
        integrationIds?: string[];
        workflowIds?: string[];
      }
    >
  >;
  approvalPolicyRef?: string;
  modelRoutingPolicyRef?: string;
}
