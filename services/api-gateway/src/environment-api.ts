import type { EnvironmentBlueprint } from "@openrabbit/runtime-core";
import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiBackend, PlatformApiRouteResult } from "./platform-api.js";

export interface EnvironmentBlueprintApiBackend extends PlatformApiBackend {
  getEnvironmentBlueprint?(orgId: string): Promise<EnvironmentBlueprint | undefined>;
}

function segments(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

/**
 * Read-only canonical environment projection endpoint.
 *
 * The API gateway can expose an environment only when its registered backend
 * explicitly implements getEnvironmentBlueprint. This keeps the HTTP/API contract
 * available while durable storage remains a separate production dependency.
 */
export async function routeEnvironmentBlueprintApi(
  request: ApiRequestEnvelope,
  backend: PlatformApiBackend
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const parts = segments(request.path);
  if (
    method !== "GET" ||
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    parts[1] !== "orgs" ||
    !parts[2] ||
    parts[3] !== "environment"
  ) {
    return { matched: false };
  }

  const orgId = parts[2];
  const environmentBackend = backend as EnvironmentBlueprintApiBackend;
  if (!environmentBackend.getEnvironmentBlueprint) {
    return {
      matched: true,
      status: 501,
      error: {
        code: "ENVIRONMENT_BACKEND_NOT_AVAILABLE",
        message: "environment blueprint backend is not available"
      }
    };
  }

  const blueprint = await environmentBackend.getEnvironmentBlueprint(orgId);
  if (!blueprint) {
    return {
      matched: true,
      status: 404,
      error: {
        code: "ENVIRONMENT_BLUEPRINT_NOT_FOUND",
        message: `Environment blueprint not found for org: ${orgId}`
      }
    };
  }

  if (blueprint.orgId !== orgId) {
    return {
      matched: true,
      status: 500,
      error: {
        code: "ENVIRONMENT_BLUEPRINT_ORG_MISMATCH",
        message: "environment blueprint backend returned state for a different org"
      }
    };
  }

  if (blueprint.protocol !== "environment_blueprint_v1") {
    return {
      matched: true,
      status: 500,
      error: {
        code: "ENVIRONMENT_BLUEPRINT_PROTOCOL_MISMATCH",
        message: "environment blueprint backend returned an unsupported protocol"
      }
    };
  }

  return { matched: true, status: 200, data: blueprint };
}
