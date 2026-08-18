import type { CrmPriority, CreateNativeCrmRelationshipInput } from "./native-crm.js";

export interface CrmAdapterRelationship {
  externalId: string;
  displayName: string;
  kind?: string;
  stage?: string;
  nextFollowUpAt?: string;
  priority?: CrmPriority;
  leadSource?: string;
  propertyIds?: string[];
  summary?: string;
  email?: string;
  phone?: string;
  tags?: string[];
}

export interface CrmAdapterPage {
  provider: string;
  relationships: CrmAdapterRelationship[];
  nextCursor?: string;
}

/**
 * Provider boundary for connected CRMs such as HubSpot or Follow Up Boss.
 * Adapters translate provider records into OpenRabbit's normalized relationship shape.
 */
export interface CrmRelationshipAdapter {
  readonly provider: string;
  listRelationships(orgId: string, cursor?: string): Promise<CrmAdapterPage>;
}

export interface CrmImportRecord extends Omit<CreateNativeCrmRelationshipInput, "id"> {
  externalId?: string;
}

export interface CrmImportRequest {
  provider: string;
  mode?: "merge" | "create_only";
  records: CrmImportRecord[];
}

export interface CrmImportResult {
  provider: string;
  created: number;
  updated: number;
  skipped: number;
  relationshipIds: string[];
}
