'use strict';

const RISK = Object.freeze({
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
  BLOCK: 'BLOCK',
});

const TRUSTED_TARGET_VERIFIERS = new Set([
  'connector-gateway',
  'browser-guard',
  'broker-adapter',
  'platform-runtime',
]);

function normalizeDomain(value) {
  if (!value) return value;
  const raw = String(value).trim().toLowerCase();
  try {
    const withScheme = raw.includes('://') ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '').replace(/\.$/, '');
  }
}

function normalizeDimension(name, value) {
  if (value == null) return value;
  if (name === 'domain') return normalizeDomain(value);
  return String(value).trim();
}

/**
 * Verify that an external side effect is aimed at the exact resource that the
 * trusted control plane intended. Worker-model assertions are not sufficient:
 * observed target identity must be supplied by a trusted adapter/guard.
 */
function validateTargetScope(action) {
  if (!action.externalSideEffect) {
    return { valid: true, reason: 'no-external-side-effect', mismatches: [] };
  }

  const binding = action.targetBinding;
  if (!binding || !TRUSTED_TARGET_VERIFIERS.has(binding.verifier)) {
    return { valid: false, reason: 'untrusted-or-missing-target-verifier', mismatches: [] };
  }
  if (binding.ambiguous) {
    return { valid: false, reason: 'ambiguous-target', mismatches: [] };
  }

  const expected = binding.expected || {};
  const observed = binding.observed || {};
  const required = new Set(binding.requiredDimensions || []);
  required.add('orgId');

  if (action.connectionId) required.add('connectionId');

  const mismatches = [];
  for (const dimension of required) {
    const left = normalizeDimension(dimension, expected[dimension]);
    const right = normalizeDimension(dimension, observed[dimension]);
    if (left == null || left === '' || right == null || right === '') {
      mismatches.push({ dimension, reason: 'missing' });
      continue;
    }
    if (left !== right) mismatches.push({ dimension, reason: 'mismatch' });
  }

  if (normalizeDimension('orgId', expected.orgId) !== normalizeDimension('orgId', action.orgId)) {
    mismatches.push({ dimension: 'orgId', reason: 'request-binding-mismatch' });
  }
  if (action.connectionId && normalizeDimension('connectionId', expected.connectionId) !== normalizeDimension('connectionId', action.connectionId)) {
    mismatches.push({ dimension: 'connectionId', reason: 'request-binding-mismatch' });
  }

  return mismatches.length
    ? { valid: false, reason: 'target-scope-mismatch', mismatches }
    : { valid: true, reason: 'trusted-target-match', mismatches: [] };
}

function decision(riskClass, execute, requireConfirmation, surface, reasons, targetVerification) {
  return { riskClass, execute, requireConfirmation, surface, reasons, targetVerification };
}

function evaluateAction(action, profile = 'seamless') {
  const targetVerification = validateTargetScope(action);
  const hardBoundary = Boolean(
    action.attemptsBoundaryEscape ||
      action.attemptsSecretExposure ||
      action.attemptsAuditBypass ||
      action.crossTenant ||
      !action.withinGrantedScope ||
      !targetVerification.valid
  );

  if (hardBoundary) {
    const reasons = ['hard-boundary'];
    if (!targetVerification.valid) reasons.push(targetVerification.reason);
    return decision(RISK.BLOCK, false, false, true, reasons, targetVerification);
  }

  const needsNewAuthority = Boolean(
    action.requestsNewPermission ||
      action.changesCredentialsOrSecurity ||
      action.destructiveBulkAction ||
      action.materialFinancialCommitment
  );

  if (needsNewAuthority) {
    return decision(
      RISK.RED,
      false,
      true,
      true,
      ['consequential-or-new-authority'],
      targetVerification
    );
  }

  if (action.unusualButAuthorized) {
    const requireConfirmation = profile !== 'seamless';
    return decision(
      RISK.YELLOW,
      !requireConfirmation,
      requireConfirmation,
      true,
      ['unusual-authorized-action'],
      targetVerification
    );
  }

  const strict = profile === 'strict';
  return decision(
    RISK.GREEN,
    !strict,
    strict,
    false,
    ['standing-authority'],
    targetVerification
  );
}

module.exports = {
  RISK,
  TRUSTED_TARGET_VERIFIERS,
  evaluateAction,
  normalizeDomain,
  validateTargetScope,
};
