"use strict";

const manifest = require("./manifest");
const commercialInvestmentWorkflow = require("./workflows/commercial-investment-workflow");
const persistence = require("./persistence/state-repository");
const { DurableUnderwritingService } = require("./persistence/durable-underwriting-service");

module.exports = {
  manifest,
  workflows: {
    commercialInvestmentWorkflow,
  },
  persistence: {
    ...persistence,
    DurableUnderwritingService,
  },
};
