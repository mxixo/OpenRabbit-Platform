"use strict";

const fs = require("fs");
const {
  SupabaseRealEstateStateRepository,
} = require("../capabilities/real-estate/persistence/state-repository");
const {
  DurableUnderwritingService,
} = require("../capabilities/real-estate/persistence/durable-underwriting-service");
const {
  InMemoryExecutionTelemetryStore,
} = require("../runtime/execution-telemetry");
const {
  ControlledOutreachTransport,
  ApprovalEnforcedOutreachService,
} = require("../capabilities/real-estate/product-api/approval-enforced-outreach");
const {
  RealEstateProductApi,
} = require("../capabilities/real-estate/product-api/product-api");
const {
  createStaticTokenAuthenticator,
  createRealEstateHttpServer,
} = require("../capabilities/real-estate/product-api/http-server");

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function loadConfig(env = process.env) {
  const port = Number(env.OPENRABBIT_API_PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("OPENRABBIT_API_PORT must be an integer from 0 to 65535");
  }
  const token = required(env, "OPENRABBIT_API_TOKEN");
  if (Buffer.byteLength(token) < 32) throw new Error("OPENRABBIT_API_TOKEN must be at least 32 bytes");
  const allowedRecipients = (env.OPENRABBIT_ALLOWED_OUTREACH_RECIPIENTS || "test-recipient@openrabbit.local")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedRecipients.length) throw new Error("At least one controlled outreach recipient is required");
  return {
    host: env.OPENRABBIT_API_HOST || "127.0.0.1",
    port,
    token,
    actorId: required(env, "OPENRABBIT_ACTOR_ID"),
    orgId: required(env, "OPENRABBIT_ORG_ID"),
    supabaseUrl: required(env, "SUPABASE_URL"),
    supabaseSecretKey: required(env, "SUPABASE_SECRET_KEY"),
    allowedRecipients,
  };
}

function createApplication(config, options = {}) {
  const repository = options.repository || new SupabaseRealEstateStateRepository({
    projectUrl: config.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  });
  const telemetryStore = options.telemetryStore || new InMemoryExecutionTelemetryStore();
  const durableService = new DurableUnderwritingService({ repository, telemetryStore });
  const transport = options.transport || new ControlledOutreachTransport({
    allowedRecipients: config.allowedRecipients,
  });
  const outreachService = new ApprovalEnforcedOutreachService({
    repository,
    durableService,
    transport,
  });
  const api = new RealEstateProductApi({ durableService, repository, outreachService });
  const authenticate = createStaticTokenAuthenticator({
    token: config.token,
    actorId: config.actorId,
    orgId: config.orgId,
  });
  const server = createRealEstateHttpServer({ api, authenticate });
  return { server, repository, transport, telemetryStore };
}

async function startApplication(config, options = {}) {
  const application = createApplication(config, options);
  await new Promise((resolve, reject) => {
    application.server.once("error", reject);
    application.server.listen(config.port, config.host, resolve);
  });
  return application;
}

async function main() {
  if (fs.existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
  }
  const config = loadConfig();
  const application = await startApplication(config);
  const address = application.server.address();
  const location = typeof address === "object" && address
    ? `${address.address}:${address.port}`
    : String(address);
  console.log(`OpenRabbit real-estate API listening on ${location}`);

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`Received ${signal}; stopping OpenRabbit real-estate API`);
    await new Promise((resolve) => application.server.close(resolve));
    process.exitCode = 0;
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`OpenRabbit real-estate API failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { loadConfig, createApplication, startApplication };
