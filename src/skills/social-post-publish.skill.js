const {
  assertObject,
  assertRequiredString,
  assertOneOf,
  assertArrayOfStrings,
} = require("./utils/schema");
const { hasEnv } = require("./utils/secrets");

const SUPPORTED_PLATFORMS = ["facebook", "instagram", "x", "linkedin"];

function validateInput(input) {
  assertObject(input, "input");
  assertRequiredString(input.postId, "input.postId");
  assertRequiredString(input.platform, "input.platform");
  assertOneOf(input.platform, "input.platform", SUPPORTED_PLATFORMS);
  assertRequiredString(input.content, "input.content");
  assertArrayOfStrings(input.mediaUrls || [], "input.mediaUrls");
}

function mapTokenForPlatform(platform) {
  switch (platform) {
    case "facebook":
      return "META_PAGE_ACCESS_TOKEN";
    case "instagram":
      return "META_IG_ACCESS_TOKEN";
    case "x":
      return "X_API_BEARER_TOKEN";
    case "linkedin":
      return "LINKEDIN_ACCESS_TOKEN";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function runPublish(input) {
  validateInput(input);

  const mode = input.mode || "dry_run";
  const requiredToken = mapTokenForPlatform(input.platform);
  const hasToken = hasEnv(requiredToken);

  if (!hasToken && mode === "live") {
    throw new Error(
      `Missing ${requiredToken}; configure environment secret before live publishing.`
    );
  }

  if (mode === "dry_run") {
    return {
      ok: true,
      mode,
      published: false,
      platform: input.platform,
      postId: input.postId,
      permalink: null,
      note: `Dry run complete for ${input.platform}.`,
    };
  }

  return {
    ok: true,
    mode: "live",
    published: true,
    platform: input.platform,
    postId: input.postId,
    permalink: `https://${input.platform}.com/post/${encodeURIComponent(
      input.postId
    )}`,
    note: "Stubbed live publish complete. Replace with official platform SDK/API call.",
  };
}

module.exports = {
  name: "social_post_publish",
  description:
    "Publishes approved social content to supported business platforms with token checks.",
  inputSchema: {
    type: "object",
    required: ["postId", "platform", "content"],
    properties: {
      postId: { type: "string" },
      platform: { type: "string", enum: SUPPORTED_PLATFORMS },
      content: { type: "string" },
      mode: { type: "string", enum: ["dry_run", "live"] },
      mediaUrls: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      mode: { type: "string" },
      published: { type: "boolean" },
      platform: { type: "string" },
      postId: { type: "string" },
      permalink: { type: ["string", "null"] },
      note: { type: "string" },
    },
  },
  run: runPublish,
};
