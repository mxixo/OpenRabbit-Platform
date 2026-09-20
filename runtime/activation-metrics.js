"use strict";

const {
  ACTION_STATES,
  CONNECTION_STATES,
  INFORMATION_STATES,
  buildTrustEvent,
  deriveConnectionState,
} = require("./onboarding-trust");

const CONNECTION_EVIDENCE_MISMATCH = "connection_state_evidence_mismatch";

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function durationMs(startedAt, occurredAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(occurredAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("occurredAt cannot be earlier than activation startedAt");
  }
  return end - start;
}

function assertVerifiedOutcomeEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("verificationEvidence is required before a win can be Verified");
  }
  requiredString(evidence.verificationId, "verificationEvidence.verificationId");
  timestamp(evidence.verifiedAt, "verificationEvidence.verifiedAt");
  if (evidence.outcomeConfirmed !== true) {
    throw new Error("verificationEvidence.outcomeConfirmed must be true");
  }
}

class ActivationTracker {
  constructor({ tenantId, userId, sessionId, startedAt = new Date() }) {
    this.tenantId = requiredString(tenantId, "tenantId");
    this.userId = requiredString(userId, "userId");
    this.sessionId = requiredString(sessionId, "sessionId");
    this.startedAt = timestamp(startedAt, "startedAt");
    this.events = [];
    this.started = false;
    this.firstPreviewRecorded = false;
    this.firstVerifiedWinRecorded = false;
  }

  _base(occurredAt) {
    return {
      tenantId: this.tenantId,
      userId: this.userId,
      sessionId: this.sessionId,
      occurredAt: timestamp(occurredAt, "occurredAt"),
    };
  }

  _append(event) {
    this.events.push(event);
    return { ...event };
  }

  start() {
    if (this.started) return { ...this.events[0] };
    this.started = true;
    return this._append(
      buildTrustEvent("onboarding_started", {
        tenantId: this.tenantId,
        userId: this.userId,
        sessionId: this.sessionId,
        occurredAt: this.startedAt,
      })
    );
  }

  recordPreview({ occurredAt = new Date(), informationState = "simulated_preview" } = {}) {
    if (!this.started) this.start();
    if (!INFORMATION_STATES.includes(informationState)) {
      throw new Error(`informationState must be one of: ${INFORMATION_STATES.join(", ")}`);
    }
    const base = this._base(occurredAt);
    const event = buildTrustEvent("preview_viewed", {
      ...base,
      informationState,
      durationMs: durationMs(this.startedAt, base.occurredAt),
      success: true,
    });
    if (!this.firstPreviewRecorded) this.firstPreviewRecorded = true;
    return this._append(event);
  }

  recordConnectionObservation({
    claimedState,
    backendEvidence = null,
    providerId,
    capabilityId,
    occurredAt = new Date(),
  } = {}) {
    if (!this.started) this.start();
    if (!CONNECTION_STATES.includes(claimedState)) {
      throw new Error(`claimedState must be one of: ${CONNECTION_STATES.join(", ")}`);
    }
    const authoritativeState = deriveConnectionState({ backendEvidence });
    const incorrectConnectedClaim =
      (claimedState === "connected" || claimedState === "verified") &&
      claimedState !== authoritativeState;
    const base = this._base(occurredAt);
    return this._append(
      buildTrustEvent("connection_state_changed", {
        ...base,
        providerId: requiredString(providerId, "providerId"),
        capabilityId: requiredString(capabilityId, "capabilityId"),
        connectionState: authoritativeState,
        success: !incorrectConnectedClaim,
        ...(incorrectConnectedClaim ? { errorCode: CONNECTION_EVIDENCE_MISMATCH } : {}),
      })
    );
  }

  recordVerifiedWin({
    verificationEvidence,
    providerId,
    capabilityId,
    actionState = "verified",
    occurredAt = new Date(),
  } = {}) {
    if (!this.started) this.start();
    if (!ACTION_STATES.includes(actionState) || actionState !== "verified") {
      throw new Error("first verified win requires actionState=verified");
    }
    assertVerifiedOutcomeEvidence(verificationEvidence);
    const base = this._base(occurredAt);
    const verifiedAt = timestamp(verificationEvidence.verifiedAt, "verificationEvidence.verifiedAt");
    if (new Date(verifiedAt).getTime() > new Date(base.occurredAt).getTime()) {
      throw new Error("verification evidence cannot be timestamped after the win event");
    }
    if (this.firstVerifiedWinRecorded) {
      throw new Error("first verified win is immutable once recorded");
    }
    this.firstVerifiedWinRecorded = true;
    return this._append(
      buildTrustEvent("first_verified_win", {
        ...base,
        providerId: requiredString(providerId, "providerId"),
        capabilityId: requiredString(capabilityId, "capabilityId"),
        actionState: "verified",
        durationMs: durationMs(this.startedAt, base.occurredAt),
        success: true,
      })
    );
  }

  snapshot() {
    return this.events.map((event) => ({ ...event }));
  }
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile50(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2) return ordered[middle];
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

function summarizeActivation(events) {
  if (!Array.isArray(events)) throw new Error("events must be an array");
  const sessionsStarted = new Set();
  const previewedSessions = new Set();
  const verifiedWinSessions = new Set();
  const firstPreviewBySession = new Map();
  const firstWinBySession = new Map();
  let incorrectConnectedStateIncidents = 0;

  for (const event of events) {
    if (!event || typeof event !== "object") throw new Error("activation events must be objects");
    const sessionId = requiredString(event.sessionId, "event.sessionId");
    if (event.eventName === "onboarding_started") sessionsStarted.add(sessionId);
    if (event.eventName === "preview_viewed") {
      previewedSessions.add(sessionId);
      if (!firstPreviewBySession.has(sessionId) && Number.isFinite(event.durationMs)) {
        firstPreviewBySession.set(sessionId, event.durationMs);
      }
    }
    if (event.eventName === "first_verified_win") {
      if (event.actionState !== "verified" || event.success !== true) {
        throw new Error("first_verified_win event must be verified and successful");
      }
      verifiedWinSessions.add(sessionId);
      if (!firstWinBySession.has(sessionId) && Number.isFinite(event.durationMs)) {
        firstWinBySession.set(sessionId, event.durationMs);
      }
    }
    if (
      event.eventName === "connection_state_changed" &&
      event.errorCode === CONNECTION_EVIDENCE_MISMATCH
    ) {
      incorrectConnectedStateIncidents += 1;
    }
  }

  const previewDurations = [...firstPreviewBySession.values()];
  const verifiedWinDurations = [...firstWinBySession.values()];
  const startedCount = sessionsStarted.size;

  return {
    sessionsStarted: startedCount,
    previewedSessions: previewedSessions.size,
    verifiedWinSessions: verifiedWinSessions.size,
    previewRate: startedCount ? previewedSessions.size / startedCount : null,
    verifiedWinRate: startedCount ? verifiedWinSessions.size / startedCount : null,
    timeToFirstPreviewMs: {
      samples: previewDurations.length,
      mean: mean(previewDurations),
      median: percentile50(previewDurations),
    },
    timeToFirstVerifiedWinMs: {
      samples: verifiedWinDurations.length,
      mean: mean(verifiedWinDurations),
      median: percentile50(verifiedWinDurations),
    },
    incorrectConnectedStateIncidents,
  };
}

module.exports = {
  CONNECTION_EVIDENCE_MISMATCH,
  ActivationTracker,
  assertVerifiedOutcomeEvidence,
  summarizeActivation,
};
