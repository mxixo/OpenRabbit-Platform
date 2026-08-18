import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { InMemoryAppIdentityStore } from "./app-bootstrap.js";

export async function routeAppBootstrapApi(
  request: ApiRequestEnvelope,
  identities: InMemoryAppIdentityStore
): Promise<PlatformApiRouteResult> {
  const path = request.path.split("?")[0];
  if (request.method.toUpperCase() !== "GET" || path !== "/v1/app/bootstrap") return { matched: false };
  const query = new URLSearchParams(request.path.split("?")[1] ?? "");
  try {
    return { matched: true, status: 200, data: identities.bootstrap(request, query.get("org") ?? undefined) };
  } catch (error) {
    const code = error instanceof Error ? error.message : "APP_BOOTSTRAP_FAILED";
    const status = code === "AUTHENTICATION_REQUIRED" || code === "UNKNOWN_ACTOR" ? 401 : 403;
    return { matched: true, status, error: { code, message: code.replaceAll("_", " ").toLowerCase() } };
  }
}
