"use strict";

const assert = require("assert");
const {
  PROTOCOL,
  REQUIRED_PHASES,
  sha256,
  validateGoogleProviderE2EEvidence,
} = require("../integrations/google/provider-e2e-evidence");

function evidence() {
  const names = REQUIRED_PHASES;
  const phases = names.map((name, index) => ({
    name,
    simulated: false,
    status: "passed",
    observed_at: new Date(Date.UTC(2026, 8, 21, 1, index, 0)).toISOString(),
    proof_id: `proof-${index + 1}`,
    backend_state: `state-${index + 1}`,
  }));
  Object.assign(phases[1], {
    authoritative_scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
  });
  Object.assign(phases[3], {
    authoritative_scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });
  Object.assign(phases[4], {
    execution_id: "exec-live-1",
    capability: "mail.send",
    policy_decision: "allow",
    provider_result: "success",
  });
  Object.assign(phases[5], { authority_state: "revoked" });
  Object.assign(phases[6], {
    authority_state: "revoked",
    execution_result: "blocked",
    error_code: "ADDITIONAL_AUTHORIZATION_REQUIRED",
  });
  Object.assign(phases[7], {
    authority_state: "connected_readonly",
    read_result: "success",
  });
  return {
    protocol: PROTOCOL,
    environment: "hosted_production_candidate",
    simulated: false,
    account_subject_hash: "sha256:account-opaque",
    run_id: "google-live-e2e-001",
    phases,
  };
}

const good = evidence();
const validated = validateGoogleProviderE2EEvidence(good);
assert.equal(validated.certified, true);
assert.equal(validated.phase_count, 8);
assert.equal(validated.evidence_sha256, sha256(good));

const signed = evidence();
signed.evidence_sha256 = sha256(signed);
assert.equal(validateGoogleProviderE2EEvidence(signed).certified, true);

const simulated = evidence();
simulated.simulated = true;
assert.throws(() => validateGoogleProviderE2EEvidence(simulated), /simulated\/mock/);

const missing = evidence();
missing.phases.splice(2, 1);
assert.throws(() => validateGoogleProviderE2EEvidence(missing), /all provider E2E phases/);

const broadInitial = evidence();
broadInitial.phases[1].authoritative_scopes.push("https://www.googleapis.com/auth/gmail.send");
assert.throws(() => validateGoogleProviderE2EEvidence(broadInitial), /must not contain write authority/);

const noUpgrade = evidence();
noUpgrade.phases[3].authoritative_scopes = [...noUpgrade.phases[1].authoritative_scopes];
assert.throws(() => validateGoogleProviderE2EEvidence(noUpgrade), /actual Google write scope/);

const noPolicy = evidence();
noPolicy.phases[4].policy_decision = "bypass";
assert.throws(() => validateGoogleProviderE2EEvidence(noPolicy), /allow policy decision/);

const fakeRevoke = evidence();
fakeRevoke.phases[6].execution_result = "success";
assert.throws(() => validateGoogleProviderE2EEvidence(fakeRevoke), /post-revoke action must be blocked/);

const recoveredWithoutRead = evidence();
recoveredWithoutRead.phases[7].read_result = "not_tested";
assert.throws(() => validateGoogleProviderE2EEvidence(recoveredWithoutRead), /real provider read/);

const duplicateProof = evidence();
duplicateProof.phases[2].proof_id = duplicateProof.phases[1].proof_id;
assert.throws(() => validateGoogleProviderE2EEvidence(duplicateProof), /reuse a proof_id/);

const sensitive = evidence();
sensitive.phases[0].access_token = "do-not-store";
assert.throws(() => validateGoogleProviderE2EEvidence(sensitive), /forbidden in release evidence/);

const tampered = evidence();
tampered.evidence_sha256 = "0".repeat(64);
assert.throws(() => validateGoogleProviderE2EEvidence(tampered), /does not match canonical evidence/);

console.log("google-provider-e2e-evidence.test.js passed");
