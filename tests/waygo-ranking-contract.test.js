const assert = require("assert");
const fs = require("fs");
const path = require("path");

const contractPath = path.join(
  __dirname,
  "..",
  "docs",
  "waygo",
  "contracts",
  "waygo_rank_v1.json"
);
const vectorsPath = path.join(
  __dirname,
  "..",
  "docs",
  "waygo",
  "contracts",
  "waygo_rank_v1_test_vectors.json"
);

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));

function scoreCandidate(candidate) {
  const weights = contract.ranking.weights;
  const scores = candidate.scores;
  const keys = Object.keys(weights);

  for (const key of keys) {
    assert(Number.isFinite(scores[key]), `missing/non-finite score: ${key}`);
    assert(scores[key] >= 0 && scores[key] <= 100, `score out of range: ${key}`);
  }
  assert(
    Number.isFinite(candidate.uncertainty_penalty) &&
      candidate.uncertainty_penalty >= 0 &&
      candidate.uncertainty_penalty <= 25,
    "uncertainty penalty must be within [0,25]"
  );

  const weighted = keys.reduce(
    (sum, key) => sum + weights[key] * scores[key],
    0
  );
  return Math.max(0, Math.min(100, weighted - candidate.uncertainty_penalty));
}

function classifyCandidate(candidate, score) {
  if (!candidate.hard_feasible || !candidate.budget_compliant) return "SKIP";
  if (score < contract.classification.MAYBE.minimum_score) return "SKIP";

  const go = contract.classification.GO;
  if (
    score >= go.minimum_score &&
    !candidate.unresolved_material_cost &&
    candidate.display_claim_supported_by_evidence &&
    !candidate.material_uncertainty &&
    !candidate.estimate_heavy
  ) {
    return "GO";
  }
  return "MAYBE";
}

assert.strictEqual(contract.contract, "waygo_rank_v1");
assert.strictEqual(contract.execution_boundary.autonomous_purchase, false);
assert.strictEqual(contract.execution_boundary.deep_link_implies_booked, false);
assert.strictEqual(contract.ranking.hard_feasibility_before_scoring, true);

const weightTotal = Object.values(contract.ranking.weights).reduce(
  (sum, value) => sum + value,
  0
);
assert(Math.abs(weightTotal - 1) < 1e-12, "ranking weights must sum to 1");
assert.strictEqual(contract.classification.GO.minimum_score, 70);
assert.strictEqual(contract.classification.MAYBE.minimum_score, 45);

for (const vector of vectors) {
  const score = scoreCandidate(vector.candidate);
  assert(
    Math.abs(score - vector.expected.score) < 1e-9,
    `${vector.name}: expected score ${vector.expected.score}, got ${score}`
  );
  assert.strictEqual(
    classifyCandidate(vector.candidate, score),
    vector.expected.classification,
    `${vector.name}: classification mismatch`
  );
}

console.log(`waygo_rank_v1 contract verified (${vectors.length} acceptance vectors)`);
