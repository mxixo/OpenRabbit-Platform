"use strict";

const fs = require("fs");
const path = require("path");

const {
  validateGoogleProviderE2EEvidence,
} = require("../integrations/google/provider-e2e-evidence");

function resolveEvidencePath({ argv = process.argv, env = process.env } = {}) {
  const fromArg = argv[2];
  const fromEnv = env.GOOGLE_PROVIDER_E2E_EVIDENCE_PATH;
  const selected = typeof fromArg === "string" && fromArg.trim()
    ? fromArg.trim()
    : typeof fromEnv === "string" && fromEnv.trim()
      ? fromEnv.trim()
      : null;
  if (!selected) {
    throw new Error(
      "Google provider E2E evidence path is required as argv[2] or GOOGLE_PROVIDER_E2E_EVIDENCE_PATH",
    );
  }
  return path.resolve(selected);
}

function loadEvidence(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Google provider E2E evidence is unreadable: ${error.message}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Google provider E2E evidence must be valid JSON: ${error.message}`);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Google provider E2E evidence must be a JSON object");
  }
  return payload;
}

function runGoogleProviderE2EPreflight({ filePath } = {}) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("filePath is required");
  }
  const resolved = path.resolve(filePath);
  const evidence = loadEvidence(resolved);
  const certification = validateGoogleProviderE2EEvidence(evidence);
  return {
    status: "ready",
    gate: certification.protocol,
    certified: certification.certified,
    run_id: certification.run_id,
    evidence_sha256: certification.evidence_sha256,
    phase_count: certification.phase_count,
  };
}

function main() {
  try {
    const filePath = resolveEvidencePath();
    const result = runGoogleProviderE2EPreflight({ filePath });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`OpenRabbit Google provider release preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  resolveEvidencePath,
  loadEvidence,
  runGoogleProviderE2EPreflight,
};
