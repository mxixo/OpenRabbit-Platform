"use strict";

const manifest = require("./manifest");
const commercialInvestmentWorkflow = require("./workflows/commercial-investment-workflow");
const persistence = require("./persistence/state-repository");
const { DurableUnderwritingService } = require("./persistence/durable-underwriting-service");
const productApi = require("./product-api/product-api");
const outreach = require("./product-api/approval-enforced-outreach");
const httpServer = require("./product-api/http-server");

module.exports = {
  manifest,
  workflows: {
    commercialInvestmentWorkflow,
  },
  persistence: {
    ...persistence,
    DurableUnderwritingService,
  },
  productApi: {
    ...productApi,
    ...outreach,
    ...httpServer,
  },
};
