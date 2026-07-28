const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const commandCenter = require(path.join(
  __dirname,
  "..",
  "..",
  ".agents",
  "skills",
  "openclaw-realestate-command-center",
  "index.js"
));

function parseArgs(argv) {
  const args = {
    providers: ["hubspot", "google_calendar", "docusign"],
    network: true,
    strict: false,
    pretty: true,
  };

  argv.forEach((arg) => {
    if (arg === "--no-network") args.network = false;
    if (arg === "--strict") args.strict = true;
    if (arg === "--compact-json") args.pretty = false;
    if (arg.startsWith("--providers=")) {
      const list = arg.split("=")[1] || "";
      args.providers = list
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
  });

  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const result = await commandCenter.handleRunIntegrationPreflight({
    providers: args.providers,
    network: args.network,
  });

  const output = args.pretty
    ? JSON.stringify(result, null, 2)
    : JSON.stringify(result);
  console.log(output);

  if (args.strict && !result.ok) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error.message,
      },
      null,
      2
    )
  );
  process.exit(1);
});
