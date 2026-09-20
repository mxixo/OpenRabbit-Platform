'use strict';

const assert = require('node:assert/strict');
const { evaluateAction, validateTargetScope } = require('../services/policy-engine/runtime');

function targetBinding(overrides = {}) {
  return {
    verifier: 'connector-gateway',
    expected: {
      orgId: 'org-1',
      connectionId: 'gmail-1',
      resourceId: 'thread-42',
      domain: 'mail.google.com',
      ...overrides.expected,
    },
    observed: {
      orgId: 'org-1',
      connectionId: 'gmail-1',
      resourceId: 'thread-42',
      domain: 'https://mail.google.com/',
      ...overrides.observed,
    },
    requiredDimensions: ['resourceId', 'domain'],
    ...overrides,
  };
}

function baseAction(overrides = {}) {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    capability: 'gmail',
    operation: 'send',
    connectionId: 'gmail-1',
    withinGrantedScope: true,
    externalSideEffect: true,
    targetBinding: targetBinding(),
    ...overrides,
  };
}

{
  const result = evaluateAction(baseAction(), 'seamless');
  assert.equal(result.riskClass, 'GREEN');
  assert.equal(result.execute, true);
  assert.equal(result.targetVerification.valid, true);
}

{
  const result = evaluateAction(
    baseAction({ targetBinding: targetBinding({ observed: { resourceId: 'thread-99' } }) })
  );
  assert.equal(result.riskClass, 'BLOCK');
  assert.equal(result.execute, false);
  assert.equal(result.targetVerification.valid, false);
  assert.ok(result.targetVerification.mismatches.some((item) => item.dimension === 'resourceId'));
}

{
  const result = evaluateAction(baseAction({ targetBinding: undefined }));
  assert.equal(result.riskClass, 'BLOCK');
  assert.equal(result.targetVerification.reason, 'untrusted-or-missing-target-verifier');
}

{
  const result = evaluateAction(
    baseAction({ targetBinding: targetBinding({ verifier: 'worker-model' }) })
  );
  assert.equal(result.riskClass, 'BLOCK');
}

{
  const result = evaluateAction(
    baseAction({ targetBinding: targetBinding({ ambiguous: true }) })
  );
  assert.equal(result.riskClass, 'BLOCK');
  assert.equal(result.targetVerification.reason, 'ambiguous-target');
}

{
  const result = evaluateAction(baseAction({ crossTenant: true }));
  assert.equal(result.riskClass, 'BLOCK');
}

{
  const result = evaluateAction(baseAction({ attemptsAuditBypass: true }));
  assert.equal(result.riskClass, 'BLOCK');
}

{
  const result = evaluateAction(baseAction({ requestsNewPermission: true }));
  assert.equal(result.riskClass, 'RED');
  assert.equal(result.requireConfirmation, true);
}

{
  const result = evaluateAction(baseAction({ unusualButAuthorized: true }), 'seamless');
  assert.equal(result.riskClass, 'YELLOW');
  assert.equal(result.execute, true);
}

{
  const result = evaluateAction(baseAction(), 'strict');
  assert.equal(result.riskClass, 'GREEN');
  assert.equal(result.execute, false);
  assert.equal(result.requireConfirmation, true);
}

{
  const result = validateTargetScope({
    orgId: 'org-1',
    externalSideEffect: false,
  });
  assert.deepEqual(result, {
    valid: true,
    reason: 'no-external-side-effect',
    mismatches: [],
  });
}

console.log('policy-engine tests passed');
