'use strict';

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'openrabbit_release_readiness_v1';
const REQUIRED_GATES = [
  'production_account_boundary_ready',
  'hosted_auth_tenant_isolation_verified',
  'environment_blueprint_migration_verified',
  'action_receipt_chain_restore_verified',
  'provider_lifecycle_certified',
  'rollback_restore_drill_passed',
  'real_estate_golden_path_e2e_passed',
  'adversarial_regression_passed',
  'privacy_retention_inventory_reviewed',
  'terms_privacy_ai_disclosures_counsel_reviewed',
  'repository_visibility_license_ip_reviewed',
  'repository_history_secret_scan_verified',
  'billing_support_escalation_ready',
  'monitoring_incident_response_ready',
  'manual_accessibility_certification_passed',
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateReleaseReadiness(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('release readiness manifest must be an object');
  }
  if (payload.protocol !== PROTOCOL) throw new Error('unsupported release readiness protocol');
  if (payload.product !== 'OpenRabbit') throw new Error('release readiness product must be OpenRabbit');
  if (!['go', 'no-go'].includes(payload.decision)) throw new Error('release readiness decision must be go or no-go');

  const rules = payload.rules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('release readiness rules are missing');
  }
  for (const [field, expected] of [
    ['all_required_gates_must_pass', true],
    ['passed_gate_requires_evidence', true],
    ['go_decision_requires_named_release_candidate', true],
    ['go_decision_requires_attribution_and_timestamp', true],
    ['waygo_is_separate_release_boundary', true],
    ['trading_v1_is_separate_financial_release_boundary', true],
  ]) {
    if (rules[field] !== expected) throw new Error(`release readiness rule drifted: ${field}`);
  }

  const gates = payload.required_gates;
  if (!gates || typeof gates !== 'object' || Array.isArray(gates)) {
    throw new Error('release readiness required_gates are missing');
  }
  const actualGateNames = Object.keys(gates).sort();
  const expectedGateNames = [...REQUIRED_GATES].sort();
  if (JSON.stringify(actualGateNames) !== JSON.stringify(expectedGateNames)) {
    throw new Error('release readiness required gate set drifted');
  }

  const blockers = [];
  for (const gateName of REQUIRED_GATES) {
    const gate = gates[gateName];
    if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
      throw new Error(`release gate ${gateName} must be an object`);
    }
    if (typeof gate.passed !== 'boolean') throw new Error(`release gate ${gateName}.passed must be boolean`);
    if (gate.passed) {
      if (!nonEmpty(gate.evidence)) throw new Error(`passed release gate ${gateName} requires evidence`);
    } else {
      blockers.push(gateName);
    }
  }

  const allPassed = blockers.length === 0;
  if (payload.decision === 'go') {
    if (!allPassed) throw new Error('go decision is forbidden while required release gates remain blocked');
    if (!nonEmpty(payload.release_candidate)) throw new Error('go decision requires a named release candidate');
    if (!nonEmpty(payload.updated_by)) throw new Error('go decision requires updated_by attribution');
    if (!nonEmpty(payload.updated_at) || Number.isNaN(Date.parse(payload.updated_at))) {
      throw new Error('go decision requires an ISO-8601 updated_at timestamp');
    }
  } else if (allPassed) {
    throw new Error('all required gates pass but release decision remains no-go; record an explicit go/no-go review');
  }

  return Object.freeze({
    protocol: PROTOCOL,
    decision: payload.decision,
    ready: payload.decision === 'go' && allPassed,
    releaseCandidate: payload.release_candidate,
    blockers: Object.freeze(blockers),
  });
}

function validateReleaseReadinessFile(filePath = path.join(__dirname, '..', 'deploy', 'production', 'release-readiness.json')) {
  return validateReleaseReadiness(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => !arg.startsWith('--'));
  const result = validateReleaseReadinessFile(fileArg);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (args.includes('--require-ready') && !result.ready) process.exitCode = 2;
}

module.exports = { PROTOCOL, REQUIRED_GATES, validateReleaseReadiness, validateReleaseReadinessFile };
