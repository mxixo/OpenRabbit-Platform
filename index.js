const dotenv = require("dotenv");
const { createSkillRunner, getSkillCatalog } = require("./src/skills");

dotenv.config();

function main() {
  const runner = createSkillRunner({
    actor: "platform",
    businessType: "real_estate",
  });

  const catalog = getSkillCatalog();
  console.log("OpenRabbit skill scaffold ready.");
  console.log("Registered skills:", catalog.map((s) => s.name).join(", "));

  return runner;
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};