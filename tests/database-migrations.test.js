"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

assert.deepStrictEqual(files, [
  "202608170001_real_estate_state.sql",
  "202608170002_execution_telemetry.sql",
]);

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  assert.ok(/create table if not exists/i.test(sql), `${file} must be idempotent for baseline creation`);
  assert.ok(/enable row level security/i.test(sql), `${file} must enable RLS`);
  assert.ok(/revoke all/i.test(sql), `${file} must revoke direct client access`);
  assert.ok(!/drop\s+(table|schema|database)/i.test(sql), `${file} must not contain destructive drops`);
}

const realEstate = fs.readFileSync(path.join(migrationsDir, files[0]), "utf8");
assert.ok(realEstate.includes("public.real_estate_deals"));
assert.ok(realEstate.includes("public.real_estate_underwriting_runs"));
assert.ok(realEstate.includes("public.real_estate_approval_requests"));
assert.ok(realEstate.includes("public.real_estate_audit_records"));

const telemetry = fs.readFileSync(path.join(migrationsDir, files[1]), "utf8");
assert.ok(telemetry.includes("public.execution_telemetry"));
assert.ok(telemetry.includes("primary key (tenant_id, execution_id, attempt)"));
assert.ok(telemetry.includes("generated always as (model_usd + external_api_usd + compute_usd) stored"));

console.log("Database migration tests passed.");
