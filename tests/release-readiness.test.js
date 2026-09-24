'use strict';

const assert = require('assert');
const {
  REQUIRED_GATES,
  validateReleaseReadiness,
  validateReleaseReadinessFile,
} = require('../scripts/release-readiness');

const current = validateReleaseReadinessFile();
assert.strictEqual(current.decision, 'no-go');
assert.strictEqual(current.ready, false);
assert.deepStrictEqual([...current.blockers].sort(), [...REQUIRED_GATES].sort());

const passingGates = Object.fromEntries(
  REQUIRED_GATES.map((name) => [name, { passed: true, evidence: `evidence://${name}` }]),
);
const rules = {
  all_required_gates_must_pass: true,
  passed_gate_requires_evidence: true,
  go_decision_requires_named_release_candidate: true,
  go_decision_requires_attribution_and_timestamp: true,
  waygo_is_separate_release_boundary: true,
  trading_v1_is_separate_financial_release_boundary: true,
};

const ready = validateReleaseReadiness({
  protocol: 'openrabbit_release_readiness_v1',
  product: 'OpenRabbit',
  release_candidate: 'rc-1',
  decision: 'go',
  updated_at: '2026-09-24T00:00:00Z',
  updated_by: 'release-owner',
  required_gates: passingGates,
  rules,
});
assert.strictEqual(ready.ready, true);
assert.deepStrictEqual(ready.blockers, []);

assert.throws(
  () => validateReleaseReadiness({
    protocol: 'openrabbit_release_readiness_v1',
    product: 'OpenRabbit',
    release_candidate: 'rc-unsafe',
    decision: 'go',
    updated_at: '2026-09-24T00:00:00Z',
    updated_by: 'release-owner',
    required_gates: {
      ...passingGates,
      production_account_boundary_ready: { passed: false, evidence: null },
    },
    rules,
  }),
  /forbidden while required release gates remain blocked/,
);

assert.throws(
  () => validateReleaseReadiness({
    protocol: 'openrabbit_release_readiness_v1',
    product: 'OpenRabbit',
    release_candidate: 'rc-no-evidence',
    decision: 'go',
    updated_at: '2026-09-24T00:00:00Z',
    updated_by: 'release-owner',
    required_gates: {
      ...passingGates,
      provider_lifecycle_certified: { passed: true, evidence: null },
    },
    rules,
  }),
  /requires evidence/,
);

assert.throws(
  () => validateReleaseReadiness({
    protocol: 'openrabbit_release_readiness_v1',
    product: 'OpenRabbit',
    release_candidate: null,
    decision: 'no-go',
    updated_at: null,
    updated_by: null,
    required_gates: passingGates,
    rules,
  }),
  /all required gates pass but release decision remains no-go/,
);

console.log('release-readiness.test.js passed');
