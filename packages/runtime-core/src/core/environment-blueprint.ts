import type {
  EnvironmentBlueprint,
  EnvironmentBlueprintInput,
  EnvironmentCapabilityProjection,
  EnvironmentComponentState,
  EnvironmentIntegrationProjection,
  EnvironmentPackProjection,
  EnvironmentSurface,
  EnvironmentSurfaceId,
  EnvironmentWorkerProjection,
} from "../interfaces/environment-blueprint.js";

const SURFACES: EnvironmentSurfaceId[] = [
  "calendar",
  "communications",
  "work",
  "intelligence",
  "social",
];

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function uniqueSorted(values: string[], field: string): string[] {
  const normalized = values.map((value) => requireText(value, field));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} must not contain duplicates`);
  }
  return [...normalized].sort((a, b) => a.localeCompare(b));
}

function assertUniqueIds<T extends { id: string }>(items: T[], field: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = requireText(item.id, `${field}.id`);
    if (seen.has(id)) {
      throw new Error(`${field} contains duplicate id ${id}`);
    }
    seen.add(id);
  }
}

function assertOrg(orgId: string, candidateOrgId: string, field: string): void {
  if (candidateOrgId !== orgId) {
    throw new Error(`${field} cannot project state from another org`);
  }
}

function normalizeState(state: EnvironmentComponentState): EnvironmentComponentState {
  return state;
}

export function resolveEnvironmentBlueprint(input: EnvironmentBlueprintInput): EnvironmentBlueprint {
  const orgId = requireText(input.orgId, "orgId");
  const revision = requireText(input.revision, "revision");
  const generatedAt = requireText(input.generatedAt, "generatedAt");
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("generatedAt must be an ISO-compatible timestamp");
  }

  const packInputs = input.packs ?? [];
  const capabilityInputs = input.capabilities ?? [];
  const integrationInputs = input.integrations ?? [];
  const workerInputs = input.workers ?? [];
  const workflows = uniqueSorted(input.workflows ?? [], "workflows");

  assertUniqueIds(packInputs, "packs");
  assertUniqueIds(capabilityInputs, "capabilities");
  assertUniqueIds(integrationInputs, "integrations");
  assertUniqueIds(workerInputs, "workers");

  for (const item of packInputs) assertOrg(orgId, item.orgId, `pack ${item.id}`);
  for (const item of capabilityInputs) assertOrg(orgId, item.orgId, `capability ${item.id}`);
  for (const item of integrationInputs) assertOrg(orgId, item.orgId, `integration ${item.id}`);
  for (const item of workerInputs) assertOrg(orgId, item.orgId, `worker ${item.id}`);

  const packs: EnvironmentPackProjection[] = packInputs
    .map((item) => ({
      id: requireText(item.id, "pack.id"),
      version: requireText(item.version, "pack.version"),
      state: item.enabled ? ("enabled" as const) : ("disabled" as const),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const capabilities: EnvironmentCapabilityProjection[] = capabilityInputs
    .map((item) => ({
      id: requireText(item.id, "capability.id"),
      version: requireText(item.version, "capability.version"),
      state: item.enabled ? ("enabled" as const) : ("disabled" as const),
      surfaces: [...new Set(item.surfaces ?? [])].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const integrations: EnvironmentIntegrationProjection[] = integrationInputs
    .map((item) => ({
      id: requireText(item.id, "integration.id"),
      state: normalizeState(item.state) as "connected" | "available" | "missing",
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const capabilityIds = new Set(capabilities.map((item) => item.id));
  const enabledCapabilityIds = new Set(
    capabilities.filter((item) => item.state === "enabled").map((item) => item.id),
  );
  const integrationIds = new Set(integrations.map((item) => item.id));
  const workflowIds = new Set(workflows);

  const workers: EnvironmentWorkerProjection[] = workerInputs
    .map((item) => {
      const ids = uniqueSorted(item.capabilityIds ?? [], `worker ${item.id}.capabilityIds`);
      for (const capabilityId of ids) {
        if (!capabilityIds.has(capabilityId)) {
          throw new Error(`worker ${item.id} references unknown capability ${capabilityId}`);
        }
      }
      return { id: requireText(item.id, "worker.id"), capabilityIds: ids };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const surfaces: EnvironmentSurface[] = SURFACES.map((surfaceId) => {
    const binding = input.surfaceBindings?.[surfaceId];
    const inferredCapabilityIds = capabilities
      .filter((item) => item.state === "enabled" && item.surfaces.includes(surfaceId))
      .map((item) => item.id);
    const boundCapabilityIds = uniqueSorted(binding?.capabilityIds ?? [], `${surfaceId}.capabilityIds`);
    const mergedCapabilityIds = [...new Set([...inferredCapabilityIds, ...boundCapabilityIds])].sort(
      (a, b) => a.localeCompare(b),
    );
    for (const capabilityId of mergedCapabilityIds) {
      if (!capabilityIds.has(capabilityId)) {
        throw new Error(`${surfaceId} references unknown capability ${capabilityId}`);
      }
      if (!enabledCapabilityIds.has(capabilityId)) {
        throw new Error(`${surfaceId} cannot bind disabled capability ${capabilityId}`);
      }
    }

    const boundIntegrationIds = uniqueSorted(
      binding?.integrationIds ?? [],
      `${surfaceId}.integrationIds`,
    );
    for (const integrationId of boundIntegrationIds) {
      if (!integrationIds.has(integrationId)) {
        throw new Error(`${surfaceId} references unknown integration ${integrationId}`);
      }
    }

    const boundWorkflowIds = uniqueSorted(binding?.workflowIds ?? [], `${surfaceId}.workflowIds`);
    for (const workflowId of boundWorkflowIds) {
      if (!workflowIds.has(workflowId)) {
        throw new Error(`${surfaceId} references unknown workflow ${workflowId}`);
      }
    }

    return {
      id: surfaceId,
      enabled:
        mergedCapabilityIds.length > 0 ||
        boundIntegrationIds.length > 0 ||
        boundWorkflowIds.length > 0,
      capabilityIds: mergedCapabilityIds,
      integrationIds: boundIntegrationIds,
      workflowIds: boundWorkflowIds,
    };
  });

  return {
    protocol: "environment_blueprint_v1",
    orgId,
    revision,
    generatedAt,
    packs,
    capabilities,
    integrations,
    workers,
    workflows,
    approvalPolicyRef: input.approvalPolicyRef
      ? requireText(input.approvalPolicyRef, "approvalPolicyRef")
      : undefined,
    modelRoutingPolicyRef: input.modelRoutingPolicyRef
      ? requireText(input.modelRoutingPolicyRef, "modelRoutingPolicyRef")
      : undefined,
    surfaces,
  };
}
