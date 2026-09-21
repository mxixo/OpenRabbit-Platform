"use strict";

const crypto = require("crypto");

const PROTOCOL = "google_provider_e2e_v1";
const REQUIRED_PHASES = [
  "hosted_sign_in",
  "readonly_authorization",
  "provider_read",
  "incremental_write_authorization",
  "governed_write_execution",
  "provider_revoke",
  "post_revoke_denial",
  "reconnect_recovery",
];
const FORBIDDEN_KEYS = new Set([
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "authorization_code",
  "authorizationcode",
  "client_secret",
  "clientsecret",
  "password",
  "message_body",
  "messagebody",
  "email_body",
  "emailbody",
  "content",
]);

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

function normalizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

function rejectSensitiveEvidence(value, path = "evidence") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveEvidence(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) throw new Error(`${path}.${key} is forbidden in release evidence`);
    rejectSensitiveEvidence(child, `${path}.${key}`);
  }
}

function parseTimestamp(value, name) {
  const text = requiredString(value, name);
  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds)) throw new Error(`${name} must be an ISO timestamp`);
  return { text, milliseconds };
}

function validateGoogleProviderE2EEvidence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("evidence must be an object");
  rejectSensitiveEvidence(input);

  if (input.protocol !== PROTOCOL) throw new Error(`protocol must equal ${PROTOCOL}`);
  if (input.environment !== "hosted_production_candidate") throw new Error("evidence must come from hosted_production_candidate");
  if (input.simulated !== false) throw new Error("simulated/mock evidence cannot certify provider readiness");
  requiredString(input.account_subject_hash, "account_subject_hash");
  requiredString(input.run_id, "run_id");

  if (!Array.isArray(input.phases)) throw new Error("phases must be an array");
  if (input.phases.length !== REQUIRED_PHASES.length) throw new Error("all provider E2E phases are required exactly once");

  const proofIds = new Set();
  let previousTimestamp = -Infinity;
  for (let index = 0; index < REQUIRED_PHASES.length; index += 1) {
    const phase = input.phases[index];
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) throw new Error(`phase ${index} must be an object`);
    if (phase.name !== REQUIRED_PHASES[index]) throw new Error(`phase ${index} must be ${REQUIRED_PHASES[index]}`);
    if (phase.simulated !== false) throw new Error(`${phase.name} cannot use simulated/mock evidence`);
    if (phase.status !== "passed") throw new Error(`${phase.name} must pass`);
    const { milliseconds } = parseTimestamp(phase.observed_at, `${phase.name}.observed_at`);
    if (milliseconds < previousTimestamp) throw new Error("provider E2E evidence timestamps must be monotonic");
    previousTimestamp = milliseconds;
    const proofId = requiredString(phase.proof_id, `${phase.name}.proof_id`);
    if (proofIds.has(proofId)) throw new Error("provider E2E phases cannot reuse a proof_id");
    proofIds.add(proofId);
    requiredString(phase.backend_state, `${phase.name}.backend_state`);
  }

  const byName = Object.fromEntries(input.phases.map(phase => [phase.name, phase]));
  const readonly = byName.readonly_authorization;
  const writeAuth = byName.incremental_write_authorization;
  const execution = byName.governed_write_execution;
  const revoked = byName.provider_revoke;
  const denial = byName.post_revoke_denial;
  const recovered = byName.reconnect_recovery;

  if (!Array.isArray(readonly.authoritative_scopes) || !readonly.authoritative_scopes.length) throw new Error("readonly_authorization must record backend-authoritative scopes");
  const initialScopes = new Set(readonly.authoritative_scopes.map(requiredScope));
  if (![...initialScopes].some(scope => scope.endsWith("/gmail.readonly")) && ![...initialScopes].some(scope => scope.endsWith("/calendar.events.readonly"))) {
    throw new Error("readonly_authorization must prove a supported read-only Google scope");
  }
  if ([...initialScopes].some(scope => scope.endsWith("/gmail.send") || scope.endsWith("/gmail.modify") || scope.endsWith("/calendar.events"))) {
    throw new Error("initial authorization evidence must not contain write authority");
  }

  if (!Array.isArray(writeAuth.authoritative_scopes)) throw new Error("incremental_write_authorization must record backend-authoritative scopes");
  const upgradedScopes = new Set(writeAuth.authoritative_scopes.map(requiredScope));
  const hasWrite = [...upgradedScopes].some(scope => scope.endsWith("/gmail.send") || scope.endsWith("/calendar.events"));
  if (!hasWrite) throw new Error("incremental authorization must prove an actual Google write scope");
  if (![...initialScopes].every(scope => upgradedScopes.has(scope))) throw new Error("incremental authorization must preserve previously granted read authority");

  requiredString(execution.execution_id, "governed_write_execution.execution_id");
  requiredString(execution.capability, "governed_write_execution.capability");
  if (execution.policy_decision !== "allow") throw new Error("governed write must include an allow policy decision");
  if (execution.provider_result !== "success") throw new Error("governed write must record real provider success");

  if (revoked.authority_state !== "revoked") throw new Error("provider_revoke must record revoked authority");
  if (denial.authority_state !== "revoked") throw new Error("post_revoke_denial must still observe revoked authority");
  if (denial.execution_result !== "blocked") throw new Error("post-revoke action must be blocked");
  if (denial.error_code !== "ADDITIONAL_AUTHORIZATION_REQUIRED" && denial.error_code !== "CONNECTION_AUTHORIZATION_REQUIRED") {
    throw new Error("post-revoke denial must be an authorization failure");
  }
  if (recovered.authority_state !== "connected_readonly") throw new Error("reconnect recovery must end in connected_readonly state");
  if (recovered.read_result !== "success") throw new Error("reconnect recovery must prove a real provider read");

  const unsigned = { ...input };
  delete unsigned.evidence_sha256;
  const expectedHash = sha256(unsigned);
  if (input.evidence_sha256 && input.evidence_sha256 !== expectedHash) throw new Error("evidence_sha256 does not match canonical evidence");

  return {
    protocol: PROTOCOL,
    certified: true,
    run_id: input.run_id,
    evidence_sha256: expectedHash,
    phase_count: REQUIRED_PHASES.length,
  };
}

function requiredScope(value) {
  return requiredString(value, "authoritative_scope");
}

module.exports = {
  PROTOCOL,
  REQUIRED_PHASES,
  sha256,
  validateGoogleProviderE2EEvidence,
};
