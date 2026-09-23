# Durable Action Receipt Ledger

OpenRabbit treats Action Receipts as control-plane evidence, not worker-owned logs. The durable ledger persists the same cryptographically sealed receipt contract already used by runtime-core while keeping the storage boundary outside the mutable model/worker context.

## Write path

`Guardian decision -> connector capability evaluation -> provider attempt -> Action Receipt -> SHA-256 seal -> server-only append ledger`

The Supabase ledger is organization-scoped and append-only. Each receipt is sealed against the immediately preceding receipt hash for that organization. Database advisory locking prevents two concurrent inserts from both becoming the canonical successor. A racing writer that loses predecessor ordering must fail and re-read/re-seal; it may not silently fork the chain.

## Storage invariants

- browser/mobile roles receive no direct table authority;
- service-role authority is limited to `SELECT` and `INSERT`;
- `UPDATE`, `DELETE`, and `TRUNCATE` are rejected by database triggers;
- row identity must agree with `receipt.id`, `receipt.orgId`, and `receipt.createdAt`;
- previous hashes must reference a receipt from the same organization;
- the API-gateway ledger re-verifies every returned receipt seal before accepting provider storage as evidence;
- the configured Supabase URL must match the explicit project ref, preventing silent project substitution.

## Restore and audit verification

`verifyOrgChain(orgId)` checks the persisted append order against every predecessor hash after each individual receipt has passed cryptographic verification. This gives recovery tooling a deterministic integrity check instead of trusting a restored table by convention.

## What this does not close

This repository capability is not proof that a production Supabase project has been deliberately designated, migrated, backed up, or restored successfully. It also does not yet provide connector-specific reconciliation for ambiguous external effects, retention/export policy, independent archival anchoring, or automatic retry/convergence for a multi-host writer race. Those remain production/commercial gates.
