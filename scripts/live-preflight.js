"use strict";

const REQUIRED_ENV = [
  "OPENRABBIT_API_TOKEN",
  "OPENRABBIT_ACTOR_ID",
  "OPENRABBIT_ORG_ID",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
];

const REQUIRED_TABLES = [
  "real_estate_deals",
  "real_estate_underwriting_runs",
  "real_estate_task_results",
  "real_estate_approval_requests",
  "real_estate_audit_records",
  "execution_telemetry",
];

function validateEnvironment(env = process.env) {
  const missing = REQUIRED_ENV.filter((name) => typeof env[name] !== "string" || !env[name].trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  if (Buffer.byteLength(env.OPENRABBIT_API_TOKEN.trim()) < 32) {
    throw new Error("OPENRABBIT_API_TOKEN must be at least 32 bytes");
  }
  let url;
  try {
    url = new URL(env.SUPABASE_URL.trim());
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS");
  return {
    supabaseUrl: url.toString().replace(/\/$/, ""),
    supabaseSecretKey: env.SUPABASE_SECRET_KEY.trim(),
  };
}

async function checkTable({ baseUrl, secretKey, table, fetchImpl = fetch }) {
  const response = await fetchImpl(`${baseUrl}/rest/v1/${table}?select=*&limit=0`, {
    method: "GET",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Required Supabase table ${table} is unavailable (${response.status}): ${detail}`);
  }
  return { table, status: "ok" };
}

async function runPreflight({ env = process.env, fetchImpl = fetch } = {}) {
  const config = validateEnvironment(env);
  const checks = [];
  for (const table of REQUIRED_TABLES) {
    checks.push(await checkTable({
      baseUrl: config.supabaseUrl,
      secretKey: config.supabaseSecretKey,
      table,
      fetchImpl,
    }));
  }
  return {
    status: "ready",
    environment: "ok",
    database: "ok",
    tables: checks.map((check) => check.table),
  };
}

async function main() {
  try {
    const result = await runPreflight();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`OpenRabbit deployment preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = { REQUIRED_ENV, REQUIRED_TABLES, validateEnvironment, checkTable, runPreflight };
