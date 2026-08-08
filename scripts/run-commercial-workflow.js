const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { createSkillRunner } = require(path.join(
  __dirname,
  "..",
  "src",
  "skills"
));

function parseInput(raw) {
  if (!raw) {
    throw new Error(
      "Missing input payload. Pass JSON string with at least {\"address\":\"...\"}."
    );
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error.message}`);
  }
}

async function run() {
  const payload = parseInput(process.argv[2]);
  const runner = createSkillRunner({
    actor: "platform",
    workflow: "commercial_investment_analysis",
  });

  const result = await runner.run("commercial_investment_workflow", payload);
  console.log(JSON.stringify(result, null, 2));
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
