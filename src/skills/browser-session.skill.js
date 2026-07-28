const {
  assertObject,
  assertRequiredString,
  assertOneOf,
} = require("./utils/schema");

const SUPPORTED_ACTIONS = ["login", "navigate", "fill_form", "submit"];

function validateInput(input) {
  assertObject(input, "input");
  assertRequiredString(input.sessionId, "input.sessionId");
  assertRequiredString(input.action, "input.action");
  assertOneOf(input.action, "input.action", SUPPORTED_ACTIONS);
  assertObject(input.target, "input.target");
  assertRequiredString(input.target.platform, "input.target.platform");
  assertRequiredString(input.target.url, "input.target.url");
}

async function runBrowserAction(input) {
  validateInput(input);

  const mode = input.mode || "dry_run";
  if (mode === "dry_run") {
    return {
      ok: true,
      mode,
      performed: false,
      note: "Dry run only. Install and wire Playwright for live browser automation.",
      action: input.action,
      platform: input.target.platform,
      url: input.target.url,
    };
  }

  let playwright;
  try {
    playwright = require("playwright");
  } catch (error) {
    throw new Error(
      "Playwright not installed. Run `npm i playwright` and retry with mode=live."
    );
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(input.target.url, { waitUntil: "domcontentloaded" });
    return {
      ok: true,
      mode: "live",
      performed: true,
      action: input.action,
      platform: input.target.platform,
      pageTitle: await page.title(),
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  name: "browser_session",
  description:
    "Manages browser-based social session actions (login, navigation, form posting steps).",
  inputSchema: {
    type: "object",
    required: ["sessionId", "action", "target"],
    properties: {
      sessionId: { type: "string" },
      action: { type: "string", enum: SUPPORTED_ACTIONS },
      mode: { type: "string", enum: ["dry_run", "live"] },
      target: {
        type: "object",
        required: ["platform", "url"],
        properties: {
          platform: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      mode: { type: "string" },
      performed: { type: "boolean" },
      action: { type: "string" },
      platform: { type: "string" },
      pageTitle: { type: "string" },
      note: { type: "string" },
    },
  },
  run: runBrowserAction,
};
