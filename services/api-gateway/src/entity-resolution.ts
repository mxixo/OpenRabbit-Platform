import type { InMemoryEmailStore, NormalizedEmailMessage } from "./email-adapter.js";
import type { InMemoryNativeCrmStore, NativeCrmRelationship } from "./native-crm.js";
import type { InMemoryPropertyStore, NormalizedPropertyRecord } from "./map-adapter.js";
import type { InMemoryContextGraphStore } from "./context-graph.js";
import { autoLinkRecordContext } from "./context-auto-link.js";

export type ResolutionTargetType = "relationship" | "property";
export type ResolutionDisposition = "auto_link" | "suggest" | "ignore";
export type ResolutionDecision = "accepted" | "rejected";

export interface EntityResolutionCandidate {
  targetType: ResolutionTargetType;
  targetId: string;
  label: string;
  confidence: number;
  disposition: ResolutionDisposition;
  reasons: string[];
}

export interface ResolutionFeedbackRecord {
  orgId: string;
  emailId: string;
  targetType: ResolutionTargetType;
  targetId: string;
  decision: ResolutionDecision;
  actorId?: string;
  confidence: number;
  reasons: string[];
  createdAt: string;
}

export interface EmailResolutionResult {
  emailId: string;
  candidates: EntityResolutionCandidate[];
  applied: EntityResolutionCandidate[];
  feedback: ResolutionFeedbackRecord[];
}

function normalizeEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/<([^>]+)>/);
  const raw = (match?.[1] ?? value).trim().toLowerCase();
  return raw.includes("@") ? raw : undefined;
}

function normalizeText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function combinedMessageText(message: NormalizedEmailMessage): string {
  return normalizeText([message.subject, message.summary, message.bodyPreview].filter(Boolean).join(" "));
}

function relationshipCandidate(message: NormalizedEmailMessage, relationship: NativeCrmRelationship): EntityResolutionCandidate | undefined {
  const sender = normalizeEmail(message.from);
  const relationshipEmail = normalizeEmail(relationship.email);
  if (sender && relationshipEmail && sender === relationshipEmail) {
    return {
      targetType: "relationship",
      targetId: relationship.id,
      label: relationship.displayName,
      confidence: 0.995,
      disposition: "auto_link",
      reasons: [`Exact normalized sender email match: ${sender}`]
    };
  }

  const haystack = combinedMessageText(message);
  const name = normalizeText(relationship.displayName);
  if (name.length >= 5 && haystack.includes(name)) {
    return {
      targetType: "relationship",
      targetId: relationship.id,
      label: relationship.displayName,
      confidence: 0.82,
      disposition: "suggest",
      reasons: ["CRM display name appears in the email subject/summary/body preview"]
    };
  }
  return undefined;
}

function propertyCandidate(message: NormalizedEmailMessage, property: NormalizedPropertyRecord): EntityResolutionCandidate | undefined {
  const haystack = combinedMessageText(message);
  const mls = normalizeText(property.mlsId);
  if (mls && haystack.split(" ").includes(mls)) {
    return {
      targetType: "property",
      targetId: property.id,
      label: property.address ?? property.label,
      confidence: 0.995,
      disposition: "auto_link",
      reasons: [`Exact MLS identifier appears in message context: ${property.mlsId}`]
    };
  }

  const address = normalizeText(property.address);
  if (address.length >= 8 && haystack.includes(address)) {
    return {
      targetType: "property",
      targetId: property.id,
      label: property.address ?? property.label,
      confidence: 0.97,
      disposition: "suggest",
      reasons: ["Normalized property address appears in email subject/summary/body preview"]
    };
  }
  return undefined;
}

function feedbackKey(orgId: string, emailId: string, targetType: ResolutionTargetType, targetId: string): string {
  return `${orgId}:${emailId}:${targetType}:${targetId}`;
}

export class EntityResolutionService {
  private readonly feedbackRecords = new Map<string, ResolutionFeedbackRecord>();

  constructor(
    private readonly emailStore: InMemoryEmailStore,
    private readonly crmStore: InMemoryNativeCrmStore,
    private readonly propertyStore: InMemoryPropertyStore,
    private readonly graph: InMemoryContextGraphStore
  ) {}

  async listFeedback(orgId: string, emailId?: string): Promise<ResolutionFeedbackRecord[]> {
    return [...this.feedbackRecords.values()]
      .filter((record) => record.orgId === orgId && (!emailId || record.emailId === emailId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async inspectEmail(orgId: string, emailId: string): Promise<EmailResolutionResult> {
    const message = await this.emailStore.get(orgId, emailId);
    if (!message) throw new Error(`Email message not found: ${emailId}`);

    const candidates: EntityResolutionCandidate[] = [];
    if (!message.relationshipId) {
      for (const relationship of await this.crmStore.list(orgId)) {
        const candidate = relationshipCandidate(message, relationship);
        if (candidate) candidates.push(candidate);
      }
    }
    if (!message.propertyId) {
      for (const property of await this.propertyStore.list(orgId)) {
        const candidate = propertyCandidate(message, property);
        if (candidate) candidates.push(candidate);
      }
    }

    const feedback = await this.listFeedback(orgId, emailId);
    const rejected = new Set(feedback.filter((record) => record.decision === "rejected").map((record) => `${record.targetType}:${record.targetId}`));
    const visible = candidates.filter((candidate) => !rejected.has(`${candidate.targetType}:${candidate.targetId}`));
    visible.sort((a, b) => b.confidence - a.confidence);
    return { emailId, candidates: visible, applied: [], feedback };
  }

  async resolveEmail(orgId: string, emailId: string): Promise<EmailResolutionResult> {
    const result = await this.inspectEmail(orgId, emailId);
    const message = await this.emailStore.get(orgId, emailId);
    if (!message) throw new Error(`Email message not found: ${emailId}`);

    const applied: EntityResolutionCandidate[] = [];
    const relationship = result.candidates.find((candidate) => candidate.targetType === "relationship" && candidate.disposition === "auto_link");
    const property = result.candidates.find((candidate) => candidate.targetType === "property" && candidate.disposition === "auto_link");

    if (relationship || property) {
      const updated = await this.emailStore.update(orgId, emailId, {
        relationshipId: relationship?.targetId ?? message.relationshipId,
        propertyId: property?.targetId ?? message.propertyId
      });
      await autoLinkRecordContext(this.graph, orgId, { type: "email", id: updated.id, label: updated.subject }, updated);
      if (relationship) applied.push(relationship);
      if (property) applied.push(property);
    }

    return { ...result, applied };
  }

  async decideEmailCandidate(input: {
    orgId: string;
    emailId: string;
    targetType: ResolutionTargetType;
    targetId: string;
    decision: ResolutionDecision;
    actorId?: string;
  }): Promise<{ message: NormalizedEmailMessage; feedback: ResolutionFeedbackRecord }> {
    const message = await this.emailStore.get(input.orgId, input.emailId);
    if (!message) throw new Error(`Email message not found: ${input.emailId}`);

    const inspected = await this.inspectEmail(input.orgId, input.emailId);
    const candidate = inspected.candidates.find((item) => item.targetType === input.targetType && item.targetId === input.targetId);
    if (!candidate) throw new Error(`Resolution candidate not found: ${input.targetType}:${input.targetId}`);

    let updated = message;
    if (input.decision === "accepted") {
      updated = await this.emailStore.update(input.orgId, input.emailId, {
        relationshipId: input.targetType === "relationship" ? input.targetId : message.relationshipId,
        propertyId: input.targetType === "property" ? input.targetId : message.propertyId
      });
      await autoLinkRecordContext(this.graph, input.orgId, { type: "email", id: updated.id, label: updated.subject }, updated);
    }

    const feedback: ResolutionFeedbackRecord = {
      orgId: input.orgId,
      emailId: input.emailId,
      targetType: input.targetType,
      targetId: input.targetId,
      decision: input.decision,
      actorId: input.actorId?.trim() || undefined,
      confidence: candidate.confidence,
      reasons: candidate.reasons,
      createdAt: new Date().toISOString()
    };
    this.feedbackRecords.set(feedbackKey(input.orgId, input.emailId, input.targetType, input.targetId), feedback);
    return { message: updated, feedback };
  }
}
