import {
  InMemoryConfigurationManager,
  InMemoryEventBus,
  InMemoryLogSink,
  InMemoryPermissionManager,
  ServiceOperationResult,
  ServiceReliabilitySnapshot,
  StructuredLogger
} from "@openrabbit/runtime-core";
import {
  ApiGatewayService,
  ApiRequestEnvelope,
  ApiResponseData,
  ServiceDescriptor,
  ServiceHealth,
  ValidationResult
} from "./contracts.js";
import { PlatformApiBackend, routePlatformApi } from "./platform-api.js";
import { routeTodayApi } from "./today-api.js";
import { routeWorkspaceApi } from "./workspace-api.js";
import { InMemoryNativeCrmStore } from "./native-crm.js";
import { routeNativeCrmApi } from "./crm-api.js";
import { InMemoryEmailStore } from "./email-adapter.js";
import { routeEmailApi } from "./email-api.js";
import { InMemoryProviderConnectionStore } from "./provider-connections.js";
import { InMemoryEmailDraftStore } from "./email-drafts.js";
import { routeProviderApi } from "./provider-api.js";
import { ProviderAuthorizationService } from "./provider-authorization-service.js";
import { InMemoryPropertyStore } from "./map-adapter.js";
import { routeMapApi } from "./map-api.js";
import { InMemorySocialStore } from "./social-adapter.js";
import { routeSocialApi } from "./social-api.js";
import { InMemoryContextGraphStore } from "./context-graph.js";
import { routeContextApi } from "./context-api.js";
import { EnvironmentAgentService } from "./environment-agent.js";
import { routeEnvironmentAgentApi } from "./environment-agent-api.js";
import { EntityResolutionService } from "./entity-resolution.js";
import { routeEntityResolutionApi } from "./entity-resolution-api.js";
import { ProviderSyncCoordinator } from "./provider-sync.js";
import { routeProviderSyncApi } from "./provider-sync-api.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function createApiGatewayService(version = "0.1.0"): ApiGatewayService {
  const config = new InMemoryConfigurationManager({ defaults: { serviceName: "api-gateway" } });
  const eventBus = new InMemoryEventBus();
  const permissionManager = new InMemoryPermissionManager();
  const logger = new StructuredLogger([new InMemoryLogSink()]).child({ service: "api-gateway" });
  const nativeCrm = new InMemoryNativeCrmStore();
  const emailStore = new InMemoryEmailStore();
  const providerConnections = new InMemoryProviderConnectionStore();
  const emailDrafts = new InMemoryEmailDraftStore();
  const providerAuthorization = new ProviderAuthorizationService(providerConnections);
  const propertyStore = new InMemoryPropertyStore();
  const socialStore = new InMemorySocialStore();
  const contextGraph = new InMemoryContextGraphStore();
  const entityResolver = new EntityResolutionService(emailStore, nativeCrm, propertyStore, contextGraph);

  permissionManager.addPolicy({ id: "allow-api-requests", effect: "allow", actions: ["read", "write"], resources: ["api-request"] });

  let started = false;
  let operationsSucceeded = 0;
  let operationsFailed = 0;
  let lastErrorCode: string | undefined;
  let platformBackend: PlatformApiBackend | undefined;
  const environmentAgent = new EnvironmentAgentService(contextGraph, emailDrafts, socialStore, () => platformBackend);
  const providerSync = new ProviderSyncCoordinator(emailStore, nativeCrm, propertyStore, socialStore, providerConnections, contextGraph, entityResolver, () => platformBackend);

  const descriptor: ServiceDescriptor = {
    serviceName: "api-gateway",
    version,
    capabilities: [
      "health", "request-validation", "request-handling", "platform-api-v1", "today-surface-v1",
      "adaptive-workspace-v1", "native-crm-v1", "crm-import-v1", "email-adapter-v1",
      "email-calendar-linkage-v1", "provider-connections-v1", "provider-oauth-bootstrap-v1",
      "email-drafts-v1", "property-map-v1", "social-queue-v1", "social-autonomy-policy-v1",
      "context-graph-v1", "environment-actions-v1", "environment-agent-planner-v1",
      "environment-agent-executor-v1", "automatic-context-linking-v1", "entity-resolution-v1",
      "provider-sync-v1"
    ]
  };

  return {
    async start(): Promise<void> { started = true; await logger.info("api-gateway started", { configKeys: config.keys() }); await eventBus.publish({ type: "service.started", payload: { service: descriptor.serviceName }, timestamp: new Date().toISOString() }); },
    async stop(): Promise<void> { started = false; await logger.info("api-gateway stopped"); },
    isStarted(): boolean { return started; },
    getDescriptor(): ServiceDescriptor { return descriptor; },
    getHealth(): ServiceHealth {
      return {
        status: started ? "ok" : "degraded", timestamp: new Date().toISOString(),
        dependencies: [
          { name: "configuration-manager", status: "up" }, { name: "event-bus", status: "up" },
          { name: "permission-manager", status: "up" }, { name: "native-crm", status: "up" },
          { name: "email-normalizer", status: "up" }, { name: "provider-connection-registry", status: "up" },
          { name: "provider-authorization", status: "up" }, { name: "provider-sync", status: "up" },
          { name: "email-draft-queue", status: "up" }, { name: "property-map-normalizer", status: "up" },
          { name: "social-queue", status: "up" }, { name: "context-graph", status: "up" },
          { name: "entity-resolution", status: "up" }, { name: "environment-agent", status: "up" },
          ...(platformBackend ? [{ name: "platform-backend", status: "up" as const }] : [])
        ]
      };
    },
    getReliabilitySnapshot(): ServiceReliabilitySnapshot { return { operationsSucceeded, operationsFailed, lastErrorCode }; },
    validateRequest(input: unknown): ValidationResult {
      const errors: string[] = [];
      const request = input as Partial<ApiRequestEnvelope>;
      if (!request?.requestId || typeof request.requestId !== "string") errors.push("requestId is required");
      if (!request?.path || typeof request.path !== "string") errors.push("path is required");
      if (!request?.method || typeof request.method !== "string") errors.push("method is required");
      else if (!ALLOWED_METHODS.has(request.method.toUpperCase())) errors.push("method is not supported");
      return { valid: errors.length === 0, errors };
    },
    registerPlatformBackend(backend: PlatformApiBackend): void { platformBackend = backend; },
    registerProviderAuthorizationAdapter(adapter): void { providerAuthorization.register(adapter); },
    registerEmailSyncAdapter(adapter): void { providerSync.registerEmailAdapter(adapter); },
    registerCrmSyncAdapter(adapter): void { providerSync.registerCrmAdapter(adapter); },
    registerPropertySyncAdapter(adapter): void { providerSync.registerPropertyAdapter(adapter); },
    registerCalendarSyncAdapter(adapter): void { providerSync.registerCalendarAdapter(adapter); },
    registerSocialSyncAdapter(adapter): void { providerSync.registerSocialAdapter(adapter); },
    async handleRequest(input: unknown): Promise<ServiceOperationResult<ApiResponseData>> {
      if (!started) { operationsFailed += 1; lastErrorCode = "SERVICE_NOT_STARTED"; return { ok: false, error: { code: "SERVICE_NOT_STARTED", message: "api-gateway service not started", retryable: true } }; }
      const validation = this.validateRequest(input);
      if (!validation.valid) { operationsFailed += 1; lastErrorCode = "INVALID_REQUEST"; return { ok: false, error: { code: "INVALID_REQUEST", message: validation.errors.join("; "), retryable: false } }; }
      const request = input as ApiRequestEnvelope;
      const action = request.method.toUpperCase() === "GET" ? "read" : "write";
      const decision = permissionManager.evaluate({ subject: { id: request.actorId ?? "anonymous", roles: request.actorRoles }, action, resource: { type: "api-request" } });
      if (!decision.allowed) { operationsFailed += 1; lastErrorCode = "PERMISSION_DENIED"; return { ok: false, error: { code: "PERMISSION_DENIED", message: decision.reason, retryable: false } }; }
      await eventBus.publish({ type: "api.request.accepted", payload: { requestId: request.requestId, path: request.path }, timestamp: new Date().toISOString() });

      if (request.path.startsWith("/v1/")) {
        if (!platformBackend) { operationsFailed += 1; lastErrorCode = "PLATFORM_BACKEND_NOT_REGISTERED"; return { ok: false, error: { code: "PLATFORM_BACKEND_NOT_REGISTERED", message: "platform API backend is not registered", retryable: true } }; }
        try {
          const crmRoute = await routeNativeCrmApi(request, nativeCrm, contextGraph);
          const emailRoute = crmRoute.matched ? crmRoute : await routeEmailApi(request, emailStore, platformBackend, contextGraph, entityResolver);
          const resolutionRoute = emailRoute.matched ? emailRoute : await routeEntityResolutionApi(request, entityResolver);
          const providerRoute = resolutionRoute.matched ? resolutionRoute : await routeProviderApi(request, providerConnections, emailDrafts, providerAuthorization);
          const syncRoute = providerRoute.matched ? providerRoute : await routeProviderSyncApi(request, providerSync);
          const mapRoute = syncRoute.matched ? syncRoute : await routeMapApi(request, propertyStore, contextGraph);
          const socialRoute = mapRoute.matched ? mapRoute : await routeSocialApi(request, socialStore, contextGraph);
          const agentRoute = socialRoute.matched ? socialRoute : await routeEnvironmentAgentApi(request, environmentAgent);
          const contextRoute = agentRoute.matched ? agentRoute : await routeContextApi(request, contextGraph);
          const workspaceBackend = {
            ...platformBackend,
            listWorkspaceRelationships: (orgId: string) => nativeCrm.workspaceItems(orgId),
            listWorkspaceEmailItems: (orgId: string, date: string) => emailStore.workspaceItems(orgId, date),
            listWorkspaceMapItems: (orgId: string) => propertyStore.workspaceItems(orgId),
            listWorkspaceSocialItems: (orgId: string, date: string) => socialStore.workspaceItems(orgId, date),
            getWorkspaceSocialAutonomyMode: async (orgId: string) => (await socialStore.getPolicy(orgId)).autonomyMode
          };
          const workspaceRoute = contextRoute.matched ? contextRoute : await routeWorkspaceApi(request, workspaceBackend);
          const todayRoute = workspaceRoute.matched ? workspaceRoute : await routeTodayApi(request, platformBackend, contextGraph);
          const routed = todayRoute.matched ? todayRoute : await routePlatformApi(request, platformBackend);
          if (!routed.matched) { operationsFailed += 1; lastErrorCode = "ROUTE_NOT_FOUND"; return { ok: false, error: { code: "ROUTE_NOT_FOUND", message: `No platform API route for ${request.method.toUpperCase()} ${request.path}`, retryable: false } }; }
          if (routed.error) { operationsFailed += 1; lastErrorCode = routed.error.code; return { ok: false, data: { status: routed.status }, error: { code: routed.error.code, message: routed.error.message, retryable: false } }; }
          operationsSucceeded += 1;
          return { ok: true, data: { status: routed.status, result: routed.data } };
        } catch (error) {
          operationsFailed += 1; lastErrorCode = "PLATFORM_BACKEND_ERROR";
          return { ok: false, error: { code: "PLATFORM_BACKEND_ERROR", message: error instanceof Error ? error.message : "platform backend failed", retryable: true } };
        }
      }
      operationsSucceeded += 1;
      return { ok: true, data: { accepted: true } };
    }
  };
}
