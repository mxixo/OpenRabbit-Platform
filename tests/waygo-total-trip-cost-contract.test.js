const assert = require("assert");
const fs = require("fs");
const path = require("path");

const contract = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_total_trip_cost_v1.json"),
    "utf8"
  )
);
const vectors = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_total_trip_cost_v1_test_vectors.json"),
    "utf8"
  )
);

function validateAmount(component, name) {
  const amounts = [component.low, component.expected, component.high];
  if (component.status === "unknown") {
    assert(amounts.every((value) => value === null), `${name}: unknown amounts must be null`);
    return;
  }

  assert(amounts.every(Number.isFinite), `${name}: resolved amounts must be finite`);
  assert(component.low >= 0, `${name}: low cannot be negative`);
  assert(component.low <= component.expected, `${name}: low > expected`);
  assert(component.expected <= component.high, `${name}: expected > high`);

  if (component.status === "not_applicable") {
    assert(amounts.every((value) => value === 0), `${name}: N/A amounts must be zero`);
  }
}

function calculateTripCost(candidate) {
  const required = contract.required_material_components;
  let lower = 0;
  let expected = 0;
  let upper = 0;
  let unresolved = false;

  for (const name of required) {
    const component = candidate.components[name];
    if (!component) {
      unresolved = true;
      continue;
    }

    assert(
      contract.component_statuses.includes(component.status),
      `${name}: invalid component status`
    );
    assert(
      contract.price_classes.includes(component.price_class),
      `${name}: invalid price class`
    );
    assert.strictEqual(
      component.currency,
      candidate.budget.currency,
      `${name}: currency must match budget currency in this normalized contract`
    );
    validateAmount(component, name);

    if (component.status === "unknown") {
      unresolved = true;
      continue;
    }

    lower += component.low;
    expected += component.expected;
    upper += component.high;
  }

  const budgetCompliant = !unresolved && upper <= candidate.budget.amount;
  const budgetHeadroom = unresolved ? null : candidate.budget.amount - upper;
  return {
    lower_bound: lower,
    expected_total: expected,
    upper_bound: upper,
    unresolved_material_cost: unresolved,
    budget_compliant: budgetCompliant,
    budget_headroom: budgetHeadroom
  };
}

assert.strictEqual(contract.contract, "waygo_total_trip_cost_v1");
assert.strictEqual(contract.execution_boundary.decision_support_only, true);
assert.strictEqual(contract.execution_boundary.autonomous_purchase, false);
assert.strictEqual(contract.execution_boundary.deep_link_implies_booked, false);
assert.strictEqual(
  contract.budget_compliance.unknown_material_cost_behavior,
  "never_treat_as_zero"
);

for (const vector of vectors) {
  assert(Number.isFinite(vector.budget.amount) && vector.budget.amount >= 0, `${vector.name}: invalid budget`);
  assert(vector.budget.currency, `${vector.name}: budget currency required`);
  assert.deepStrictEqual(
    calculateTripCost(vector),
    vector.expected,
    `${vector.name}: total-trip-cost result mismatch`
  );
}

console.log(`waygo_total_trip_cost_v1 contract verified (${vectors.length} acceptance vectors)`);
