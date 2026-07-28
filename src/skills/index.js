const browserSessionSkill = require("./browser-session.skill");
const socialPostPublishSkill = require("./social-post-publish.skill");
const postComplianceGuardSkill = require("./post-compliance-guard.skill");
const commercialInvestmentWorkflowSkill = require("./commercial-investment-workflow.skill");
const { assertRequiredString } = require("./utils/schema");

const skillCatalog = [
  browserSessionSkill,
  socialPostPublishSkill,
  postComplianceGuardSkill,
  commercialInvestmentWorkflowSkill,
];

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
