'use strict';

const VALID_RISK_LEVELS = new Set(['read', 'write_internal', 'write_external']);
const VALID_POLICIES = new Set(['read_only', 'draft_only', 'approval_required', 'policy_autonomous']);
const VALID_PROVIDER_STATES = new Set(['available', 'degraded', 'disabled', 'incompatible', 'retired']);

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object') throw new Error('registry must be an object');
  requireNonEmptyString(registry.registry_version, 'registry_version');
  if (!Array.isArray(registry.capabilities) || registry.capabilities.length === 0) {
    throw new Error('registry.capabilities must be a non-empty array');
  }
  if (!Array.isArray(registry.providers) || registry.providers.length === 0) {
    throw new Error('registry.providers must be a non-empty array');
  }

  const capabilityIds = new Set();
  for (const capability of registry.capabilities) {
    requireNonEmptyString(capability.capability_id, 'capability_id');
    requireNonEmptyString(capability.contract_version, `${capability.capability_id}.contract_version`);
    if (capabilityIds.has(capability.capability_id)) {
      throw new Error(`duplicate capability_id: ${capability.capability_id}`);
    }
    capabilityIds.add(capability.capability_id);

    if (!VALID_RISK_LEVELS.has(capability.risk_level)) {
      throw new Error(`${capability.capability_id} has invalid risk_level`);
    }
    if (!VALID_POLICIES.has(capability.default_execution_policy)) {
      throw new Error(`${capability.capability_id} has invalid default_execution_policy`);
    }
    if (!Array.isArray(capability.providers) || capability.providers.length === 0) {
      throw new Error(`${capability.capability_id} must declare at least one provider`);
    }
    if (capability.emits_telemetry !== true) {
      throw new Error(`${capability.capability_id} must emit telemetry`);
    }

    if (capability.risk_level === 'write_external') {
      if (capability.supports_idempotency !== true) {
        throw new Error(`${capability.capability_id} external writes must support idempotency`);
      }
      if (capability.requires_target_verification !== true) {
        throw new Error(`${capability.capability_id} external writes must require target verification`);
      }
      if (capability.verification_receipt_required !== true) {
        throw new Error(`${capability.capability_id} external writes must require verification receipts`);
      }
    }
  }

  const providerIds = new Set();
  for (const provider of registry.providers) {
    requireNonEmptyString(provider.provider_id, 'provider_id');
    if (providerIds.has(provider.provider_id)) {
      throw new Error(`duplicate provider_id: ${provider.provider_id}`);
    }
    providerIds.add(provider.provider_id);
    if (provider.credential_scope !== 'tenant') {
      throw new Error(`${provider.provider_id} credential_scope must be tenant`);
    }
    if (!VALID_PROVIDER_STATES.has(provider.state)) {
      throw new Error(`${provider.provider_id} has invalid state`);
    }
    if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) {
      throw new Error(`${provider.provider_id} must declare capabilities`);
    }
    for (const capabilityId of provider.capabilities) {
      if (!capabilityIds.has(capabilityId)) {
        throw new Error(`${provider.provider_id} references unknown capability ${capabilityId}`);
      }
      const capability = registry.capabilities.find((item) => item.capability_id === capabilityId);
      if (!capability.providers.includes(provider.provider_id)) {
        throw new Error(
          `${capabilityId} and ${provider.provider_id} disagree about capability support`
        );
      }
    }
  }

  for (const capability of registry.capabilities) {
    for (const providerId of capability.providers) {
      const provider = registry.providers.find((item) => item.provider_id === providerId);
      if (!provider) {
        throw new Error(`${capability.capability_id} references unknown provider ${providerId}`);
      }
      if (!provider.capabilities.includes(capability.capability_id)) {
        throw new Error(
          `${capability.capability_id} and ${providerId} disagree about capability support`
        );
      }
    }
  }

  return {
    registryVersion: registry.registry_version,
    capabilityCount: registry.capabilities.length,
    providerCount: registry.providers.length,
    externalWriteCount: registry.capabilities.filter((item) => item.risk_level === 'write_external').length,
  };
}

module.exports = { validateRegistry };
