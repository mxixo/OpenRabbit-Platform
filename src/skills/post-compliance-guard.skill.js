const {
  assertObject,
  assertRequiredString,
  assertArrayOfStrings,
} = require("./utils/schema");

const REQUIRED_REAL_ESTATE_TERMS = ["equal housing opportunity"];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function findMissingTerms(content, requiredTerms) {
  const lowered = normalize(content);
  return requiredTerms.filter((term) => !lowered.includes(term));
}

async function runComplianceGuard(input) {
  assertObject(input, "input");
  assertRequiredString(input.postId, "input.postId");
  assertRequiredString(input.content, "input.content");
  assertArrayOfStrings(input.requiredTerms || REQUIRED_REAL_ESTATE_TERMS, "input.requiredTerms");

  const requiredTerms = input.requiredTerms || REQUIRED_REAL_ESTATE_TERMS;
  const missingTerms = findMissingTerms(input.content, requiredTerms);
  const blockedPhrases = (input.blockedPhrases || []).filter((phrase) =>
    normalize(input.content).includes(normalize(phrase))
  );

  const approved = missingTerms.length === 0 && blockedPhrases.length === 0;
  return {
    ok: true,
    postId: input.postId,
    approved,
    missingTerms,
    blockedPhrasesFound: blockedPhrases,
    recommendation: approved
      ? "Approved for publish."
      : "Revise content before publish.",
  };
}

module.exports = {
  name: "post_compliance_guard",
  description:
    "Validates social post copy against required real estate disclosures and blocked phrases.",
  inputSchema: {
    type: "object",
    required: ["postId", "content"],
    properties: {
      postId: { type: "string" },
      content: { type: "string" },
      requiredTerms: {
        type: "array",
        items: { type: "string" },
      },
      blockedPhrases: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      postId: { type: "string" },
      approved: { type: "boolean" },
      missingTerms: {
        type: "array",
        items: { type: "string" },
      },
      blockedPhrasesFound: {
        type: "array",
        items: { type: "string" },
      },
      recommendation: { type: "string" },
    },
  },
  run: runComplianceGuard,
};
