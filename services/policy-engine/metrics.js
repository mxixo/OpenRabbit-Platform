'use strict';

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function durationMs(start, end) {
  if (!start || !end) return null;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return b - a;
}

function hasTargetVerification(receipt) {
  return Boolean(
    receipt &&
      receipt.targetVerification &&
      typeof receipt.targetVerification.valid === 'boolean'
  );
}

function summarizePolicyReceipts(receipts) {
  if (!Array.isArray(receipts)) throw new TypeError('receipts must be an array');

  const riskCounts = { GREEN: 0, YELLOW: 0, RED: 0, BLOCK: 0, UNKNOWN: 0 };
  let policyCovered = 0;
  let confirmations = 0;
  let autoExecute = 0;
  let surfaced = 0;
  let externalSideEffects = 0;
  let targetVerificationPerformed = 0;
  let targetMatches = 0;
  let providerExecutionAttempts = 0;
  let providerVerified = 0;
  let failed = 0;

  const executionLatencyMs = [];
  const verificationLatencyMs = [];

  for (const receipt of receipts) {
    const policy = receipt && receipt.policy;
    const riskClass = policy && riskCounts[policy.riskClass] !== undefined
      ? policy.riskClass
      : 'UNKNOWN';
    riskCounts[riskClass] += 1;

    if (riskClass !== 'UNKNOWN') policyCovered += 1;
    if (policy && policy.requireConfirmation === true) confirmations += 1;
    if (policy && policy.execute === true) autoExecute += 1;
    if (policy && policy.surface === true) surfaced += 1;
    if (receipt && receipt.status === 'failed') failed += 1;

    if (receipt && receipt.externalSideEffect === true) {
      externalSideEffects += 1;
      if (hasTargetVerification(receipt)) {
        targetVerificationPerformed += 1;
        if (receipt.targetVerification.valid === true) targetMatches += 1;
      }

      // A blocked/proposed action has not attempted a provider side effect yet.
      // Executed, verified, or failed actions require reconciliation evidence.
      if (!['proposed', 'blocked'].includes(receipt.status)) {
        providerExecutionAttempts += 1;
        if (receipt.status === 'verified' && receipt.providerReceiptId) {
          providerVerified += 1;
        }
      }
    }

    const execution = durationMs(receipt && receipt.requestedAt, receipt && receipt.executedAt);
    if (execution !== null) executionLatencyMs.push(execution);
    const verification = durationMs(receipt && receipt.executedAt, receipt && receipt.verifiedAt);
    if (verification !== null) verificationLatencyMs.push(verification);
  }

  const total = receipts.length;
  const summary = {
    totalReceipts: total,
    riskCounts,
    policyCoverage: ratio(policyCovered, total),
    confirmationRate: ratio(confirmations, total),
    autoExecuteRate: ratio(autoExecute, total),
    surfacedRate: ratio(surfaced, total),
    blockRate: ratio(riskCounts.BLOCK, total),
    failureRate: ratio(failed, total),
    externalSideEffectCount: externalSideEffects,
    targetVerificationCoverage: ratio(targetVerificationPerformed, externalSideEffects),
    targetMatchRate: ratio(targetMatches, externalSideEffects),
    providerExecutionAttemptCount: providerExecutionAttempts,
    providerVerificationCoverage: ratio(providerVerified, providerExecutionAttempts),
    executionLatencyMs: {
      count: executionLatencyMs.length,
      p50: percentile(executionLatencyMs, 50),
      p95: percentile(executionLatencyMs, 95),
    },
    verificationLatencyMs: {
      count: verificationLatencyMs.length,
      p50: percentile(verificationLatencyMs, 50),
      p95: percentile(verificationLatencyMs, 95),
    },
  };

  summary.integrityWarnings = [];
  if (total > 0 && summary.policyCoverage !== 1) {
    summary.integrityWarnings.push('policy-coverage-below-100-percent');
  }
  if (externalSideEffects > 0 && summary.targetVerificationCoverage !== 1) {
    summary.integrityWarnings.push('target-verification-coverage-below-100-percent');
  }
  if (providerExecutionAttempts > 0 && summary.providerVerificationCoverage !== 1) {
    summary.integrityWarnings.push('provider-verification-coverage-below-100-percent');
  }

  return summary;
}

module.exports = { summarizePolicyReceipts, percentile };
