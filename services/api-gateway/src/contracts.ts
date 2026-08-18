import {
  ServiceHealthReport,
  ServiceOperationResult,
  ServiceReliabilitySnapshot
} from "@openrabbit/runtime-core";
import type { PlatformApiBackend } from "./platform-api.js";
import type { DelegatedAuthorizationAdapter } from "./provider-connections.js";
import type { EmailAdapter } from "./email-adapter.js";
import type { CrmRelationshipAdapter } from "./crm-adapter.js";
import type { PropertyAdapter } from "./map-adapter.js";
import type { CalendarAdapter } from "./calendar-adapter.js";
import type { SocialSourceAdapter } from "./social-adapter.js";
import type { AppUser, OrganizationMembership } from "./app-bootstrap.js";

export interface ServiceDescriptor {
  serviceName: "api-gateway";
  version: string;
  capabilities: string[];
}

export type ServiceHealth = ServiceHealthReport;

export interface ApiRequestEnvelope {
  requestId: string;
  path: string;
  method: string;
  body?: unknown;
  actorId?: string;
  actorRoles?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ApiResponseData {
  accepted?: boolean;
  status?: number;
  result?: unknown;
}

export interface ApiGatewayService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  validateRequest(input: unknown): ValidationResult;
  registerPlatformBackend(backend: PlatformApiBackend): void;
  registerProviderAuthorizationAdapter(adapter: DelegatedAuthorizationAdapter): void;
  registerEmailSyncAdapter(adapter: EmailAdapter): void;
  registerCrmSyncAdapter(adapter: CrmRelationshipAdapter): void;
  registerPropertySyncAdapter(adapter: PropertyAdapter): void;
  registerCalendarSyncAdapter(adapter: CalendarAdapter): void;
  registerSocialSyncAdapter(adapter: SocialSourceAdapter): void;
  registerAppUser(user: AppUser): void;
  registerOrganizationMembership(userId: string, membership: OrganizationMembership): void;
  handleRequest(input: unknown): Promise<ServiceOperationResult<ApiResponseData>>;
}
