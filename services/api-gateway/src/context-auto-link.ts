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
  record: { relationshipId?: string; propertyId?: string; propertyIds?: string[] }
): Promise<void> {
  if (record.relationshipId) {
    await linkOnce(graph, orgId, entity, { type: "relationship", id: record.relationshipId }, "related_to");
  }
  if (record.propertyId) {
    await linkOnce(graph, orgId, entity, { type: "property", id: record.propertyId }, "about");
  }
  for (const propertyId of record.propertyIds ?? []) {
    if (propertyId) await linkOnce(graph, orgId, entity, { type: "property", id: propertyId }, "related_to");
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
