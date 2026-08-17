"use strict";

const assert = require("assert");
const { REQUIRED_TABLES, validateEnvironment, runPreflight } = require("../scripts/live-preflight");

const validEnv = {
  OPENRABBIT_API_TOKEN: "deployment-preflight-secret-at-least-32-bytes",
  OPENRABBIT_ACTOR_ID: "operator-1",
  OPENRABBIT_ORG_ID: "org-1",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "server-only-secret-key",
};

async function runTests() {
  assert.throws(() => validateEnvironment({}), /Missing required environment variables/);
  assert.throws(() => validateEnvironment({ ...validEnv, OPENRABBIT_API_TOKEN: "short" }), /at least 32 bytes/);
  assert.throws(() => validateEnvironment({ ...validEnv, SUPABASE_URL: "http:\/\/example.supabase.co" }), /must use HTTPS/);

  const requested = [];
  const fetchImpl = async (url, options) => {
    requested.push({ url, options });
    return Response.json([]);
  };
  const result = await runPreflight({ env: validEnv, fetchImpl });
  assert.strictEqual(result.status, "ready");
  assert.deepStrictEqual(result.tables, REQUIRED_TABLES);
  assert.strictEqual(requested.length, REQUIRED_TABLES.length);
  assert.ok(requested.every((request) => request.options.headers.apikey === validEnv.SUPABASE_SECRET_KEY));
  assert.ok(requested.every((request) => request.options.headers.Authorization === `Bearer ${validEnv.SUPABASE_SECRET_KEY}`));

  await assert.rejects(
    () => runPreflight({
      env: validEnv,
      fetchImpl: async (url) => {
        if (url.includes("execution_telemetry")) return new Response("missing relation", { status: 404 });
        return Response.json([]);
      },
    }),
    /execution_telemetry is unavailable/
  );

  console.log("Deployment preflight tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
