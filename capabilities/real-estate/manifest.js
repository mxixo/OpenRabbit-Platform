"use strict";

const commercialInvestmentWorkflow = require("./workflows/commercial-investment-workflow");

const manifest = {
  id: "real-estate",
  version: "0.1.0",
  name: "Real Estate",
  description:
    "Real-estate analysis capabilities, beginning with commercial investment screening and underwriting.",
  tools: [
    {
      name: "deal.underwrite",
      description: commercialInvestmentWorkflow.description,
      inputSchema: commercialInvestmentWorkflow.inputSchema,
      outputSchema: commercialInvestmentWorkflow.outputSchema,
      tags: ["real-estate", "underwriting", "commercial"],
    },
  ],
  workflows: [
    {
      id: "commercial-investment",
      version: "0.1.0",
      name: "Commercial investment analysis",
      description: commercialInvestmentWorkflow.description,
      templateRef:
        "capabilities/real-estate/workflows/commercial-investment-workflow.js",
      tags: ["real-estate", "underwriting", "commercial"],
    },
  ],
  integrations: [],
  tags: ["vertical", "real-estate"],
  metadata: {
    optionalIntegrations: ["camino", "rentcast", "mls"],
    migrationSource: "src/skills/commercial-investment-workflow.skill.js",
  },
};

module.exports = manifest;
