const assert = require("assert");
const fs = require("fs");
const path = require("path");

const contract = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_itinerary_v1.json"),
    "utf8"
  )
);
const providerContract = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_provider_evidence_v1.json"),
    "utf8"
  )
);
const vectors = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_itinerary_v1_test_vectors.json"),
    "utf8"
  )
);

function evaluateItinerary(vector) {
  const tripStart = Date.parse(vector.trip_start);
  const tripEnd = Date.parse(vector.trip_end);
  assert(Number.isFinite(tripStart) && Number.isFinite(tripEnd) && tripStart < tripEnd);

  const reasons = [];
  const warnings = [];
  let previousEnd = null;

  for (const block of vector.blocks) {
    for (const field of contract.block_rules.required_fields) {
      assert(Object.hasOwn(block, field), `${vector.name}: block missing ${field}`);
    }
    assert(contract.block_rules.kinds.includes(block.kind), `${vector.name}: invalid block kind`);

    const start = Date.parse(block.start_local);
    const end = Date.parse(block.end_local);
    assert(Number.isFinite(start) && Number.isFinite(end), `${vector.name}: invalid block time`);
    if (end <= start) reasons.push("non_positive_duration");
    if (start < tripStart || end > tripEnd) reasons.push("outside_trip_window");

    if (previousEnd !== null) {
      if (start < previousEnd) {
        reasons.push("overlap");
      } else {
        const gapMinutes = (start - previousEnd) / 60000;
        if (gapMinutes < block.min_transfer_from_previous_minutes) {
          reasons.push("insufficient_transfer_time");
        }
      }
    }

    if (block.opening_status === "known_closed") reasons.push("known_closed");
    if (block.opening_status === "unknown") warnings.push("unknown_opening_hours");
    previousEnd = Math.max(previousEnd ?? end, end);
  }

  if (vector.material_unknown) warnings.push("material_unknown");
  if (!vector.current_cost_revision) warnings.push("stale_cost_revision");

  if (reasons.length) return { readiness: "BLOCKED", reasons, warnings };
  if (warnings.length) return { readiness: "REVIEW", reasons, warnings };
  return { readiness: "READY", reasons, warnings };
}

assert.strictEqual(contract.contract, "waygo_itinerary_v1");
assert.strictEqual(contract.execution_boundary.planning_only, true);
assert.strictEqual(contract.execution_boundary.autonomous_purchase, false);
assert.strictEqual(contract.execution_boundary.infer_booking, false);
assert.strictEqual(contract.booking_state.deep_link_never_changes_state, true);
assert.strictEqual(providerContract.contract, "waygo_provider_evidence_v1");
assert.strictEqual(providerContract.amount_contract.zero_never_inferred_from_provider_failure, true);
assert.strictEqual(providerContract.provenance_contract.secret_or_token_fields_forbidden, true);
assert.strictEqual(providerContract.provenance_contract.booking_state_not_inferred_from_link_or_quote, true);
assert.strictEqual(providerContract.execution_boundary.autonomous_purchase, false);

for (const vector of vectors) {
  const result = evaluateItinerary(vector);
  assert.strictEqual(
    result.readiness,
    vector.expected.readiness,
    `${vector.name}: readiness mismatch (${JSON.stringify(result)})`
  );
  if (vector.expected.reason_contains) {
    assert(
      [...result.reasons, ...result.warnings].includes(vector.expected.reason_contains),
      `${vector.name}: missing expected reason ${vector.expected.reason_contains}`
    );
  }
  if (vector.expected.warnings) {
    assert.deepStrictEqual(result.warnings, vector.expected.warnings, `${vector.name}: warnings mismatch`);
  }
}

console.log(`waygo_itinerary_v1 contract verified (${vectors.length} acceptance vectors)`);
