"use strict";

const manifest = require("./manifest");
const commercialInvestmentWorkflow = require("./workflows/commercial-investment-workflow");

module.exports = {
  manifest,
  workflows: {
    commercialInvestmentWorkflow,
  },
};
