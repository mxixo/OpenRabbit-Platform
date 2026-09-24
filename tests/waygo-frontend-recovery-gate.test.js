'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(
  __dirname,
  '..',
  'docs',
  'waygo',
  'contracts',
  'waygo_frontend_recovery_gate_v1.json',
);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

assert.strictEqual(contract.contract, 'waygo_frontend_recovery_gate_v1');
assert.strictEqual(contract.status, 'source_recovery_required');
assert.strictEqual(contract.authoritative_source.provider, 'Hostinger AI Builder');
assert.strictEqual(contract.authoritative_source.authoritative_baseline_required, true);
assert.strictEqual(
  contract.authoritative_source.site_identity_must_come_from_authenticated_provider_discovery,
  true,
);
assert.strictEqual(contract.authoritative_source.guess_or_construct_site_id, false);
assert.strictEqual(contract.authoritative_source.reconstruct_ui_from_memory, false);

for (const required of [
  'recovered_at_utc',
  'source_system',
  'source_site_identity',
  'source_artifact_sha256',
  'route_inventory',
  'screen_inventory',
  'auth_assumptions',
  'network_dependencies',
  'environment_variable_names',
  'persistence_mutation_inventory',
]) {
  assert(contract.recovery_manifest_required_fields.includes(required));
}

assert.strictEqual(contract.inventory_rules.routes_must_be_observed_not_inferred, true);
assert.strictEqual(contract.inventory_rules.screens_must_be_observed_not_inferred, true);
assert.strictEqual(contract.inventory_rules.environment_variables_record_names_only, true);
assert.strictEqual(contract.inventory_rules.unknown_dependencies_remain_unknown_until_observed, true);

assert.strictEqual(contract.supabase_alignment.reference_contract, 'waygo_supabase_persistence_v1');
assert.strictEqual(contract.supabase_alignment.project_ref, 'zwrsapkgdfsvvaoefhqf');
assert.deepStrictEqual(
  contract.supabase_alignment.favorites_allowed_authenticated_operations,
  ['SELECT', 'INSERT', 'DELETE'],
);
assert.strictEqual(contract.supabase_alignment.favorites_update_must_not_be_inferred, true);
assert.deepStrictEqual(
  contract.supabase_alignment.passport_allowed_authenticated_operations,
  ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
);
assert.strictEqual(contract.supabase_alignment.cross_user_owner_id_from_ui_forbidden, true);
assert.strictEqual(contract.supabase_alignment.schema_mutation_authorized_by_recovery, false);

assert.strictEqual(contract.repository_bootstrap_gate.dedicated_private_waygo_repository_required, true);
assert.strictEqual(contract.repository_bootstrap_gate.import_only_after_authoritative_baseline_recovered, true);
assert.strictEqual(contract.repository_bootstrap_gate.first_commit_must_record_source_artifact_sha256, true);
assert.strictEqual(contract.repository_bootstrap_gate.ci_required_before_feature_changes, true);
assert.strictEqual(contract.repository_bootstrap_gate.route_screen_smoke_check_required_before_feature_changes, true);

assert.strictEqual(contract.secret_and_evidence_rules.commit_secret_values, false);
assert.strictEqual(contract.secret_and_evidence_rules.commit_provider_tokens, false);
assert.strictEqual(contract.secret_and_evidence_rules.commit_private_keys, false);
assert.strictEqual(contract.secret_and_evidence_rules.invent_live_prices, false);
assert.strictEqual(contract.secret_and_evidence_rules.represent_estimates_as_bookable_quotes, false);
assert.strictEqual(contract.secret_and_evidence_rules.provider_failure_must_not_become_zero_price, true);

assert.strictEqual(contract.release_gate.frontend_feature_changes_permitted_before_recovery, false);
assert.strictEqual(contract.release_gate.live_provider_wiring_permitted_before_recovery, false);
assert.strictEqual(contract.release_gate.booking_execution_permitted_before_transaction_controls, false);
assert.strictEqual(contract.release_gate.persistent_itinerary_schema_permitted_before_frontend_inventory, false);

console.log('waygo-frontend-recovery-gate.test.js passed');
