import type { WorkspaceMapItem } from "./workspace-contracts.js";

export type PropertyRecordKind = "listing" | "opportunity" | "client" | "comp" | "appointment" | "other";

export interface NormalizedPropertyRecord extends WorkspaceMapItem {
  orgId: string;
  provider?: string;
  externalId?: string;
  mlsId?: string;
  relationshipIds?: string[];
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  units?: number;
  status?: string;
  streetViewUrl?: string;
  listingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyProviderRecord {
  externalId: string;
  label: string;
  latitude: number;
  longitude: number;
  kind?: PropertyRecordKind;
  address?: string;
  price?: number;
  mlsId?: string;
  relationshipIds?: string[];
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  units?: number;
  status?: string;
  streetViewUrl?: string;
  listingUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Provider boundary for MLS/property/geospatial sources such as Flexmls adapters. */
export interface PropertyAdapter {
  readonly provider: string;
  listProperties(orgId: string, query?: { updatedSince?: string; bounds?: MapBounds }): Promise<PropertyProviderRecord[]>;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

function id(): string {
  return `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export class InMemoryPropertyStore {
  private readonly records = new Map<string, NormalizedPropertyRecord>();

  async list(orgId: string, bounds?: MapBounds): Promise<NormalizedPropertyRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.orgId === orgId)
      .filter((record) => !bounds || (
        record.latitude <= bounds.north &&
        record.latitude >= bounds.south &&
        record.longitude <= bounds.east &&
        record.longitude >= bounds.west
      ));
  }

  async get(orgId: string, recordId: string): Promise<NormalizedPropertyRecord | undefined> {
    const record = this.records.get(recordId);
    return record?.orgId === orgId ? record : undefined;
  }

  async import(input: { orgId: string; provider: string; records: PropertyProviderRecord[] }): Promise<{ imported: number; updated: number; items: NormalizedPropertyRecord[] }> {
    let imported = 0;
    let updated = 0;
    const items: NormalizedPropertyRecord[] = [];

    for (const incoming of input.records) {
      if (!incoming.externalId?.trim()) throw new Error("property externalId is required");
      if (!incoming.label?.trim()) throw new Error("property label is required");
      if (!validCoordinate(incoming.latitude, incoming.longitude)) throw new Error("valid latitude and longitude are required");

      const existing = [...this.records.values()].find((record) =>
        record.orgId === input.orgId && record.provider === input.provider && record.externalId === incoming.externalId
      );
      const now = new Date().toISOString();
      const next: NormalizedPropertyRecord = {
        ...(existing ?? { id: id(), orgId: input.orgId, createdAt: now }),
        provider: input.provider.trim().toLowerCase(),
        externalId: incoming.externalId.trim(),
        label: incoming.label.trim(),
        latitude: incoming.latitude,
        longitude: incoming.longitude,
        kind: incoming.kind ?? "listing",
        address: clean(incoming.address),
        price: incoming.price,
        mlsId: clean(incoming.mlsId),
        relationshipIds: incoming.relationshipIds,
        propertyType: clean(incoming.propertyType),
        bedrooms: incoming.bedrooms,
        bathrooms: incoming.bathrooms,
        units: incoming.units,
        status: clean(incoming.status),
        streetViewUrl: clean(incoming.streetViewUrl),
        listingUrl: clean(incoming.listingUrl),
        metadata: incoming.metadata,
        updatedAt: now
      };
      this.records.set(next.id, next);
      existing ? updated++ : imported++;
      items.push(next);
    }

    return { imported, updated, items };
  }

  async workspaceItems(orgId: string): Promise<WorkspaceMapItem[]> {
    return (await this.list(orgId)).map((record) => ({
      id: record.id,
      label: record.label,
      latitude: record.latitude,
      longitude: record.longitude,
      kind: record.kind,
      address: record.address,
      price: record.price,
      relationshipIds: record.relationshipIds,
      metadata: {
        ...(record.metadata ?? {}),
        provider: record.provider,
        externalId: record.externalId,
        mlsId: record.mlsId,
        propertyType: record.propertyType,
        bedrooms: record.bedrooms,
        bathrooms: record.bathrooms,
        units: record.units,
        status: record.status,
        streetViewUrl: record.streetViewUrl,
        listingUrl: record.listingUrl
      }
    }));
  }
}
