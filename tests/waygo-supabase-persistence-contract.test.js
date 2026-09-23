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
  'waygo_supabase_persistence_v1.json',
);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

assert.strictEqual(contract.contract, 'waygo_supabase_persistence_v1');
assert.strictEqual(contract.status, 'verified_backend_reference');
assert.strictEqual(contract.provider, 'supabase');
assert.match(contract.project_ref, /^[a-z0-9]{20}$/);

const favorites = contract.tables.waygo_favorites;
assert.strictEqual(favorites.rls_required, true);
assert.strictEqual(favorites.owner_column, 'user_id');
assert.strictEqual(favorites.owner_identity, 'auth.uid()');
assert.deepStrictEqual(
  favorites.allowed_authenticated_operations,
  ['SELECT', 'INSERT', 'DELETE'],
);
assert.deepStrictEqual(favorites.forbidden_authenticated_operations, ['UPDATE']);
assert.deepStrictEqual(favorites.constraints.unique, ['user_id', 'idea_key']);
assert.deepStrictEqual(favorites.constraints.idea_key_length, [3, 201]);
assert.deepStrictEqual(favorites.constraints.destination_trimmed_length, [1, 120]);
assert.deepStrictEqual(favorites.constraints.country_trimmed_length, [1, 80]);
assert.strictEqual(favorites.constraints.user_delete_behavior, 'cascade');
assert.strictEqual(favorites.mutation_semantics.save, 'INSERT');
assert.strictEqual(favorites.mutation_semantics.unsave, 'DELETE');

const passport = contract.tables.waygo_passport;
assert.strictEqual(passport.rls_required, true);
assert.strictEqual(passport.owner_column, 'user_id');
assert.strictEqual(passport.owner_identity, 'auth.uid()');
assert.deepStrictEqual(
  passport.allowed_authenticated_operations,
  ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
);
assert.deepStrictEqual(passport.constraints.status_allowed, ['planned', 'visited']);
assert.deepStrictEqual(passport.constraints.destination_trimmed_length, [1, 120]);
assert.deepStrictEqual(passport.constraints.country_trimmed_length, [1, 80]);
assert.strictEqual(passport.lifecycle.planned.visit_date, null);
assert.strictEqual(passport.lifecycle.planned.visited_confirmed, false);
assert.strictEqual(passport.lifecycle.visited.visit_date_required, true);
assert.strictEqual(passport.lifecycle.visited.visit_date_not_future, true);
assert.strictEqual(passport.lifecycle.visited.visited_confirmed, true);
assert.strictEqual(passport.constraints.user_delete_behavior, 'cascade');

assert.strictEqual(
  contract.frontend_integration_rules.authenticated_user_id_must_be_used_for_owner_column,
  true,
);
assert.strictEqual(
  contract.frontend_integration_rules.never_accept_cross_user_owner_id_from_ui,
  true,
);
assert.strictEqual(contract.frontend_integration_rules.favorites_update_must_not_be_assumed, true);
assert.strictEqual(
  contract.frontend_integration_rules.passport_visited_state_requires_explicit_confirmation,
  true,
);
assert.strictEqual(
  contract.frontend_integration_rules.passport_future_visit_cannot_be_marked_visited,
  true,
);
assert.strictEqual(contract.recovery_boundary.authoritative_frontend_source_still_required, true);
assert.strictEqual(contract.recovery_boundary.contract_does_not_reconstruct_missing_ui, true);
assert.strictEqual(contract.recovery_boundary.contract_does_not_authorize_schema_mutation, true);

console.log('waygo-supabase-persistence-contract.test.js passed');
