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

function createOpenClawSkillRunner(context = {}) {
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

module.exports = {
  getSkillCatalog,
  createOpenClawSkillRunner,
};
