'use strict';

const assert = require('node:assert/strict');
const registry = require('../capabilities/registry.json');
const { validateRegistry } = require('../capabilities/validate-registry');

{
  const result = validateRegistry(registry);
  assert.equal(result.registryVersion, '1.2.0');
  assert.equal(result.capabilityCount, registry.capabilities.length);
  assert.ok(result.externalWriteCount > 0);
}

{
  const broken = structuredClone(registry);
  const send = broken.capabilities.find((item) => item.capability_id === 'mail.send');
  send.requires_target_verification = false;
  assert.throws(() => validateRegistry(broken), /target verification/);
}

{
  const broken = structuredClone(registry);
  const send = broken.capabilities.find((item) => item.capability_id === 'mail.send');
  send.supports_idempotency = false;
  assert.throws(() => validateRegistry(broken), /idempotency/);
}

{
  const broken = structuredClone(registry);
  const send = broken.capabilities.find((item) => item.capability_id === 'mail.send');
  send.verification_receipt_required = false;
  assert.throws(() => validateRegistry(broken), /verification receipts/);
}

{
  const broken = structuredClone(registry);
  broken.providers[0].credential_scope = 'global';
  assert.throws(() => validateRegistry(broken), /credential_scope must be tenant/);
}

{
  const broken = structuredClone(registry);
  broken.providers[0].capabilities.push('mail.send');
  assert.throws(() => validateRegistry(broken), /disagree about capability support|unknown/);
}

console.log('capability registry contract tests passed');
