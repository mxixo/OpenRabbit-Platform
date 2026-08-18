import type { ContextEntityRef, InMemoryContextGraphStore } from "./context-graph.js";

async function linkOnce(
  graph: InMemoryContextGraphStore,
  orgId: string,
  from: ContextEntityRef,
  to: ContextEntityRef,
  relation: "related_to" | "about" | "scheduled_from" | "owned_by" | "generated_from" | "mentions" | "follow_up_for" | "other",
  source: "user" | "worker" | "system" | "provider" = "system"
): Promise<void> {
  const existing = await graph.listLinks(orgId, from);
  const duplicate = existing.some((link) =>
    link.relation === relation &&
    ((link.from.type === from.type && link.from.id === from.id && link.to.type === to.type && link.to.id === to.id) ||
      (link.to.type === from.type && link.to.id === from.id && link.from.type === to.type && link.from.id === to.id))
  );
  if (!duplicate) await graph.addLink(orgId, { from, to, relation, source, confidence: 1 });
}

export async function autoLinkRecordContext(
  graph: InMemoryContextGraphStore,
  orgId: string,
  entity: ContextEntityRef,
  record: {
    relationshipId?: string;
    relationshipIds?: string[];
    propertyId?: string;
    propertyIds?: string[];
  }
): Promise<void> {
  const relationshipIds = [record.relationshipId, ...(record.relationshipIds ?? [])].filter(Boolean) as string[];
  const propertyIds = [record.propertyId, ...(record.propertyIds ?? [])].filter(Boolean) as string[];

  for (const relationshipId of [...new Set(relationshipIds)]) {
    await linkOnce(graph, orgId, entity, { type: "relationship", id: relationshipId }, "related_to");
  }
  for (const propertyId of [...new Set(propertyIds)]) {
    await linkOnce(
      graph,
      orgId,
      entity,
      { type: "property", id: propertyId },
      entity.type === "email" || entity.type === "social" ? "about" : "related_to"
    );
  }
}

export async function autoLinkScheduledFromEmail(
  graph: InMemoryContextGraphStore,
  orgId: string,
  emailId: string,
  calendarId: string
): Promise<void> {
  await linkOnce(
    graph,
    orgId,
    { type: "calendar", id: calendarId },
    { type: "email", id: emailId },
    "scheduled_from",
    "system"
  );
}
