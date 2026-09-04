const commercialInvestmentWorkflowSkill = require("./commercial-investment-workflow.skill");
const { assertRequiredString } = require("./utils/schema");
const skillCatalog = [commercialInvestmentWorkflowSkill];

function getSkillCatalog() {
  return skillCatalog.map((skill) => ({
    name: skill.name,
    description: skill.description,
    inputSchema: skill.inputSchema,
    outputSchema: skill.outputSchema,
  }));
}

function createSkillRunner(context = {}) {
  return {
    context,
    async run(skillName, input) {
      assertRequiredString(skillName, "skillName");
      const skill = skillCatalog.find((item) => item.name === skillName);
      if (!skill) {
        throw new Error(
          `Skill not found: ${skillName}. Available: ${skillCatalog
            .map((item) => item.name)
            .join(", ")}`
        );
      }
      return skill.run({
        ...input,
        _context: context,
      });
    },
  };
}

/**
 * @deprecated Use createSkillRunner() for product-edge code. OpenClaw-specific
 * execution now belongs behind runtimes/openclaw.
 */
function createOpenClawSkillRunner(context = {}) {
  return createSkillRunner(context);
}

module.exports = {
  getSkillCatalog,
  createSkillRunner,
  createOpenClawSkillRunner,
};
