"use strict";

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function validateCredential(input, index) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`OPENRABBIT_API_CREDENTIALS_JSON credential ${index + 1} must be an object`);
  }
  const token = required(input.token, `credential ${index + 1} token`);
  if (Buffer.byteLength(token) < 32) throw new Error(`credential ${index + 1} token must be at least 32 bytes`);
  return {
    token,
    actorId: required(input.actorId, `credential ${index + 1} actorId`),
    orgId: required(input.orgId, `credential ${index + 1} orgId`),
  };
}

function loadApiCredentials(env = process.env) {
  if (typeof env.OPENRABBIT_API_CREDENTIALS_JSON === "string" && env.OPENRABBIT_API_CREDENTIALS_JSON.trim()) {
    let parsed;
    try {
      parsed = JSON.parse(env.OPENRABBIT_API_CREDENTIALS_JSON);
    } catch {
      throw new Error("OPENRABBIT_API_CREDENTIALS_JSON must be valid JSON");
    }
    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error("OPENRABBIT_API_CREDENTIALS_JSON must be a non-empty array");
    }
    const credentials = parsed.map(validateCredential);
    const tokens = new Set();
    for (const credential of credentials) {
      if (tokens.has(credential.token)) throw new Error("OPENRABBIT_API_CREDENTIALS_JSON contains a duplicate token");
      tokens.add(credential.token);
    }
    return credentials;
  }

  const token = required(env.OPENRABBIT_API_TOKEN, "OPENRABBIT_API_TOKEN");
  if (Buffer.byteLength(token) < 32) throw new Error("OPENRABBIT_API_TOKEN must be at least 32 bytes");
  return [{
    token,
    actorId: required(env.OPENRABBIT_ACTOR_ID, "OPENRABBIT_ACTOR_ID"),
    orgId: required(env.OPENRABBIT_ORG_ID, "OPENRABBIT_ORG_ID"),
  }];
}

module.exports = { loadApiCredentials, validateCredential };
