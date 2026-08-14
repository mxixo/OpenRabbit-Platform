# Capability: Real Estate

This is the canonical home for real-estate domain functionality inside OpenRabbit.

## Implemented now

- `manifest.js` — concrete capability manifest
- `workflows/commercial-investment-workflow.js` — canonical commercial investment screening/underwriting workflow
- `index.js` — capability exports
- `utils/schema.js` — capability-local validation helpers

The legacy path under `src/skills/commercial-investment-workflow.skill.js` is now only a compatibility shim that re-exports the capability implementation.

## Current manifest

- id: `real-estate`
- tool: `deal.underwrite`
- workflow: `commercial-investment`

The underwriting workflow requires an address, purchase price, and annual gross
income. It returns base, downside, and upside scenarios; input provenance and
data-quality warnings; a diligence checklist; and a decision object with a
target price and explicit approval boundaries for consequential next actions.

Analysis and outreach drafting are read-only. CRM writes, sending outreach, and
contacting a listing broker are proposed actions that remain approval-gated.

## Durable vertical-slice state

`persistence/` provides an async repository boundary for deal records,
versioned underwriting reports, task idempotency, canonical approval records,
and audit events. The default test adapter is in-memory with an injectable
backing store. The Supabase adapter uses server-only secret-key access; its
schema is in `integrations/supabase/real-estate-state/schema.sql`.

The Supabase tables are not granted to `anon` or `authenticated`. Until the
platform authentication model is wired, they are backend-only and every query
must include `org_id`. Never expose a Supabase secret key to a frontend.

## Minimal product API and controlled outreach

`product-api/` exposes the narrow deal workflow through a transport-neutral API
handler: create/get a deal, run/list underwriting versions, request and decide
an outreach approval, execute the approved action, and read approvals/audit.

The first outreach transport is intentionally controlled-test only. It accepts
only an explicit recipient allowlist, re-checks the persisted tenant-matched
approval during execution, and uses an idempotency key to prevent duplicate
delivery. It does not send real email or messages.
- current required integrations: none
- optional integrations recorded for later adapters: Camino, Rentcast, MLS

Keeping optional integrations non-required lets the pack install and run with provided underwriting inputs today while preserving clear extension points for richer property data later.

## Workflow scope

1. Accept a commercial property address and deal assumptions.
2. Gather provided property information and optional Camino location context.
3. Estimate NOI, cap rate, debt service, DSCR, cash flow, and cash-on-cash return.
4. Score the opportunity.
5. Generate an investment summary, structured report, and investor outreach draft.

## Pack relationship

`packs/real-estate` composes this capability with Acquisitions Analyst and Research Analyst worker presets. New real-estate workflows should be added here rather than under product-edge skill directories.
