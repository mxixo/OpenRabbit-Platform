'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  validateProductionAccountBoundaryText,
} = require('../scripts/production-account-boundary');

const manifestPath = path.join(__dirname, '..', 'deploy', 'production', 'account-boundary.yaml');
const current = fs.readFileSync(manifestPath, 'utf8');

const verifiedCurrent = validateProductionAccountBoundaryText(current);
assert.strictEqual(verifiedCurrent.status, 'undesignated');
assert.strictEqual(verifiedCurrent.projectRef, null);
assert.strictEqual(verifiedCurrent.projectUrl, null);
assert.strictEqual(verifiedCurrent.failClosed, true);

const designated = current
  .replace('status: undesignated', 'status: designated')
  .replace('project_ref: null', 'project_ref: abcdefghijklmnopqrst')
  .replace('project_url: null', 'project_url: https://abcdefghijklmnopqrst.supabase.co')
  .replace('designated_by: null', 'designated_by: owner-record-001')
  .replace('designated_at: null', 'designated_at: 2026-09-23T15:00:00Z');
const verifiedDesignated = validateProductionAccountBoundaryText(designated);
assert.strictEqual(verifiedDesignated.status, 'designated');
assert.strictEqual(verifiedDesignated.projectRef, 'abcdefghijklmnopqrst');
assert.strictEqual(verifiedDesignated.projectUrl, 'https://abcdefghijklmnopqrst.supabase.co');

assert.throws(
  () => validateProductionAccountBoundaryText(current.replace('status: undesignated', 'status: designated')),
  /requires a canonical 20-character Supabase project_ref/,
);

assert.throws(
  () => validateProductionAccountBoundaryText(designated.replace(
    'project_url: https://abcdefghijklmnopqrst.supabase.co',
    'project_url: https://different-project.supabase.co',
  )),
  /project_url must match project_ref exactly/,
);

assert.throws(
  () => validateProductionAccountBoundaryText(current.replace('may_share_with_waygo: false', 'may_share_with_waygo: true')),
  /dedicated boundary separate from WayGo/,
);

assert.throws(
  () => validateProductionAccountBoundaryText(current.replace(
    'provider_project_status_healthy',
    'provider_project_status_optional',
  )),
  /designation prerequisite list drifted/,
);

assert.throws(
  () => validateProductionAccountBoundaryText(current.replace(
    'fail_closed_when_undesignated: true',
    'fail_closed_when_undesignated: false',
  )),
  /must fail closed while undesignated/,
);

console.log('production-account-boundary.test.js passed');
