"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { PROTOCOL, REQUIRED_PHASES } = require("../integrations/google/provider-e2e-evidence");
const {
  resolveEvidencePath,
  loadEvidence,
  runGoogleProviderE2EPreflight,
} = require("../scripts/google-provider-e2e-preflight");

function evidence() {
  const phases = REQUIRED_PHASES.map((name, index) => ({
    name,
    simulated: false,
    status: "passed",
    observed_at: new Date(Date.UTC(2026, 8, 21, 1, index, 0)).toISOString(),
    proof_id: `preflight-proof-${index + 1}`,
    backend_state: `state-${index + 1}`,
  }));
  phases[1].authoritative_scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ];
  phases[3].authoritative_scopes = [
    ...phases[1].authoritative_scopes,
    "https://www.googleapis.com/auth/gmail.send",
  ];
  Object.assign(phases[4], {
    execution_id: "exec-live-preflight-1",
    capability: "mail.send",
    policy_decision: "allow",
    provider_result: "success",
  });
  phases[5].authority_state = "revoked";
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
    account_subject_hash: "sha256:opaque-test-account",
    run_id: "google-live-e2e-preflight-test",
    phases,
  };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openrabbit-google-e2e-"));
try {
  const validPath = path.join(tempRoot, "evidence.json");
  fs.writeFileSync(validPath, `${JSON.stringify(evidence())}\n`, "utf8");

  const result = runGoogleProviderE2EPreflight({ filePath: validPath });
  assert.equal(result.status, "ready");
  assert.equal(result.gate, PROTOCOL);
  assert.equal(result.certified, true);
  assert.equal(result.phase_count, REQUIRED_PHASES.length);
  assert.equal(result.run_id, "google-live-e2e-preflight-test");
  assert.equal(result.evidence_sha256.length, 64);

  assert.equal(resolveEvidencePath({ argv: ["node", "script", validPath], env: {} }), validPath);
  assert.equal(resolveEvidencePath({ argv: ["node", "script"], env: { GOOGLE_PROVIDER_E2E_EVIDENCE_PATH: validPath } }), validPath);
  assert.throws(() => resolveEvidencePath({ argv: ["node", "script"], env: {} }), /evidence path is required/);

  const invalidJson = path.join(tempRoot, "invalid.json");
  fs.writeFileSync(invalidJson, "{not-json", "utf8");
  assert.throws(() => loadEvidence(invalidJson), /must be valid JSON/);

  const simulatedPath = path.join(tempRoot, "simulated.json");
  const simulated = evidence();
  simulated.simulated = true;
  fs.writeFileSync(simulatedPath, JSON.stringify(simulated), "utf8");
  assert.throws(
    () => runGoogleProviderE2EPreflight({ filePath: simulatedPath }),
    /simulated\/mock evidence cannot certify provider readiness/,
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("google-provider-e2e-preflight.test.js passed");
