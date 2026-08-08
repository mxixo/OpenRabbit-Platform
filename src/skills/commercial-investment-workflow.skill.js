"use strict";

// Compatibility shim: the canonical implementation now belongs to the
// Real Estate capability. Keep this path so existing callers and commands do
// not break while product-edge skill ownership is migrated incrementally.
module.exports = require("../../capabilities/real-estate/workflows/commercial-investment-workflow");
