'use strict';

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'openrabbit_production_account_boundary_v1';
const REQUIRED_BEFORE_DESIGNATION = [
  'owner_designation_recorded',
  'provider_project_identity_verified',
  'provider_project_status_healthy',
  'auth_inventory_reviewed',
  'schema_inventory_reviewed',
];
const REQUIRED_BEFORE_PRODUCTION = [
  'environment_blueprint_migration_verified',
  'action_receipt_migration_verified',
  'action_receipt_chain_restore_verified',
  'hosted_auth_tenant_isolation_verified',
  'provider_lifecycle_certified',
  'rollback_restore_drill_passed',
];

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseNarrowYaml(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('production account boundary manifest must be non-empty text');
  }
  const result = {};
  let section = null;

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '' || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (indent === 0) {
      const match = /^([a-z0-9_]+):(?:\s*(.*))?$/.exec(line);
      if (!match) throw new Error(`unsupported top-level YAML line: ${line}`);
      const [, key, rawValue = ''] = match;
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        throw new Error(`duplicate top-level manifest field: ${key}`);
      }
      if (rawValue === '') {
        result[key] = null;
        section = key;
      } else {
        result[key] = parseScalar(rawValue);
        section = null;
      }
      continue;
    }

    if (indent !== 2 || !section) {
      throw new Error(`unsupported manifest indentation: ${rawLine}`);
    }
    if (line.startsWith('- ')) {
      if (result[section] === null) result[section] = [];
      if (!Array.isArray(result[section])) {
        throw new Error(`manifest section ${section} mixes map and list values`);
      }
      result[section].push(parseScalar(line.slice(2)));
      continue;
    }

    const match = /^([a-z0-9_]+):\s*(.+)$/.exec(line);
    if (!match) throw new Error(`unsupported nested YAML line: ${line}`);
    if (result[section] === null) result[section] = {};
    if (Array.isArray(result[section]) || typeof result[section] !== 'object') {
      throw new Error(`manifest section ${section} mixes list and map values`);
    }
    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(result[section], key)) {
      throw new Error(`duplicate field ${section}.${key}`);
    }
    result[section][key] = parseScalar(rawValue);
  }
  return result;
}

function sameOrderedValues(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function validateProductionAccountBoundaryText(text) {
  const manifest = parseNarrowYaml(text);
  if (manifest.protocol !== PROTOCOL) throw new Error('unsupported production account boundary protocol');
  if (manifest.product !== 'OpenRabbit') throw new Error('production account boundary product must be OpenRabbit');
  if (manifest.provider !== 'supabase') throw new Error('production account boundary provider must be supabase');
  if (!['undesignated', 'designated'].includes(manifest.status)) {
    throw new Error('production account boundary status must be undesignated or designated');
  }
  if (manifest.fail_closed_when_undesignated !== true) {
    throw new Error('production account boundary must fail closed while undesignated');
  }

  const separation = manifest.separation_requirements;
  if (!separation || typeof separation !== 'object' || Array.isArray(separation)) {
    throw new Error('production account boundary separation requirements are missing');
  }
  if (separation.dedicated_product_boundary !== true || separation.may_share_with_waygo !== false) {
    throw new Error('OpenRabbit production must remain a dedicated boundary separate from WayGo');
  }
  if (!sameOrderedValues(manifest.required_before_status_designated, REQUIRED_BEFORE_DESIGNATION)) {
    throw new Error('designation prerequisite list drifted from the production boundary protocol');
  }
  if (!sameOrderedValues(manifest.required_before_production_use, REQUIRED_BEFORE_PRODUCTION)) {
    throw new Error('production-use prerequisite list drifted from the production boundary protocol');
  }

  if (manifest.status === 'undesignated') {
    for (const field of ['project_ref', 'project_url', 'designated_by', 'designated_at']) {
      if (manifest[field] !== null) {
        throw new Error(`undesignated production boundary requires ${field}: null`);
      }
    }
  } else {
    if (typeof manifest.project_ref !== 'string' || !/^[a-z0-9]{20}$/.test(manifest.project_ref)) {
      throw new Error('designated production boundary requires a canonical 20-character Supabase project_ref');
    }
    const expectedUrl = `https://${manifest.project_ref}.supabase.co`;
    if (manifest.project_url !== expectedUrl) {
      throw new Error('designated production boundary project_url must match project_ref exactly');
    }
    if (typeof manifest.designated_by !== 'string' || manifest.designated_by.trim() === '') {
      throw new Error('designated production boundary requires designated_by evidence');
    }
    if (typeof manifest.designated_at !== 'string' || Number.isNaN(Date.parse(manifest.designated_at))) {
      throw new Error('designated production boundary requires an ISO-8601 designated_at timestamp');
    }
  }

  return Object.freeze({
    protocol: manifest.protocol,
    status: manifest.status,
    projectRef: manifest.project_ref,
    projectUrl: manifest.project_url,
    failClosed: manifest.fail_closed_when_undesignated,
  });
}

function validateProductionAccountBoundaryFile(filePath = path.join(__dirname, '..', 'deploy', 'production', 'account-boundary.yaml')) {
  return validateProductionAccountBoundaryText(fs.readFileSync(filePath, 'utf8'));
}

if (require.main === module) {
  const verified = validateProductionAccountBoundaryFile(process.argv[2]);
  process.stdout.write(`${JSON.stringify(verified)}\n`);
}

module.exports = {
  PROTOCOL,
  validateProductionAccountBoundaryFile,
  validateProductionAccountBoundaryText,
};
