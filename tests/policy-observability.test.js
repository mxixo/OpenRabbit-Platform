'use strict';

const assert = require('node:assert/strict');
const { summarizePolicyReceipts } = require('../services/policy-engine/metrics');

function verifiedReceipt(overrides = {}) {
  return {
    receiptId: 'r-1',
    externalSideEffect: true,
    status: 'verified',
    providerReceiptId: 'provider-1',
    policy: {
      riskClass: 'GREEN',
      execute: true,
      requireConfirmation: false,
      surface: false,
    },
    targetVerification: {
      valid: true,
      reason: 'trusted-target-match',
    },
    requestedAt: '2026-09-20T10:00:00.000Z',
    executedAt: '2026-09-20T10:00:00.100Z',
    verifiedAt: '2026-09-20T10:00:00.300Z',
    ...overrides,
  };
}

{
  const summary = summarizePolicyReceipts([
    verifiedReceipt(),
    verifiedReceipt({
      receiptId: 'r-2',
      requestedAt: '2026-09-20T10:00:01.000Z',
      executedAt: '2026-09-20T10:00:01.400Z',
      verifiedAt: '2026-09-20T10:00:01.900Z',
    }),
  ]);

  assert.equal(summary.policyCoverage, 1);
  assert.equal(summary.targetVerificationCoverage, 1);
  assert.equal(summary.targetMatchRate, 1);
  assert.equal(summary.providerVerificationCoverage, 1);
  assert.deepEqual(summary.integrityWarnings, []);
  assert.deepEqual(summary.executionLatencyMs, { count: 2, p50: 100, p95: 400 });
  assert.deepEqual(summary.verificationLatencyMs, { count: 2, p50: 200, p95: 500 });
}

{
  const summary = summarizePolicyReceipts([
    verifiedReceipt({ policy: undefined }),
  ]);
  assert.equal(summary.policyCoverage, 0);
  assert.ok(summary.integrityWarnings.includes('policy-coverage-below-100-percent'));
}

{
  const summary = summarizePolicyReceipts([
    verifiedReceipt({ targetVerification: undefined }),
  ]);
  assert.equal(summary.targetVerificationCoverage, 0);
  assert.ok(summary.integrityWarnings.includes('target-verification-coverage-below-100-percent'));
}

{
  const blocked = verifiedReceipt({
    status: 'blocked',
    providerReceiptId: undefined,
    policy: {
      riskClass: 'BLOCK',
      execute: false,
      requireConfirmation: false,
      surface: true,
    },
    targetVerification: {
      valid: false,
      reason: 'target-scope-mismatch',
    },
    executedAt: undefined,
    verifiedAt: undefined,
  });
  const summary = summarizePolicyReceipts([blocked]);

  assert.equal(summary.targetVerificationCoverage, 1);
  assert.equal(summary.targetMatchRate, 0);
  assert.equal(summary.providerExecutionAttemptCount, 0);
  assert.equal(summary.providerVerificationCoverage, null);
  assert.deepEqual(summary.integrityWarnings, []);
}

{
  const failed = verifiedReceipt({
    status: 'failed',
    providerReceiptId: undefined,
    verifiedAt: undefined,
  });
  const summary = summarizePolicyReceipts([failed]);

  assert.equal(summary.providerExecutionAttemptCount, 1);
  assert.equal(summary.providerVerificationCoverage, 0);
  assert.equal(summary.failureRate, 1);
  assert.ok(summary.integrityWarnings.includes('provider-verification-coverage-below-100-percent'));
}

{
  const internal = verifiedReceipt({
    externalSideEffect: false,
    status: 'verified',
    providerReceiptId: undefined,
    targetVerification: undefined,
  });
  const summary = summarizePolicyReceipts([internal]);

  assert.equal(summary.externalSideEffectCount, 0);
  assert.equal(summary.targetVerificationCoverage, null);
  assert.equal(summary.providerVerificationCoverage, null);
  assert.deepEqual(summary.integrityWarnings, []);
}

{
  const invalidTimes = verifiedReceipt({
    executedAt: '2026-09-20T09:59:59.000Z',
    verifiedAt: 'not-a-time',
  });
  const summary = summarizePolicyReceipts([invalidTimes]);
  assert.equal(summary.executionLatencyMs.count, 0);
  assert.equal(summary.verificationLatencyMs.count, 0);
}

console.log('policy observability tests passed');
