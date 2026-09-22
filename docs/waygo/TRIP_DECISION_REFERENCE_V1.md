# WayGo trip-decision reference V1

Status: portable pre-source-recovery reference. This is intentionally stored in OpenRabbit-Platform only until the authoritative WayGo front end is recovered and a dedicated WayGo repository is created. It does not reconstruct or replace the production UI.

## Product decision

WayGo starts from **“Where to next?”** Budget and available time are primary constraints; destination is optional. The system should discover feasible destinations/deals, model the complete trip cost, rank alternatives transparently, and generate a usable itinerary without turning estimates into bookable quotes.

The machine-readable contract is `docs/waygo/contracts/waygo_rank_v1.json`. Executable acceptance vectors live beside it and are verified by `tests/waygo-ranking-contract.test.js`.

## Deterministic ranking

Hard feasibility is evaluated before preference scoring. The V1 component score is:

- 35% affordability / budget headroom;
- 20% usable-time efficiency;
- 20% experience fit;
- 10% itinerary/logistical coherence;
- 15% evidence quality / completeness / freshness;
- minus 0–25 points of explicit uncertainty penalty.

Each component is scored 0–100. The result is clamped to 0–100. These are versioned product defaults, not empirically optimized travel outcomes.

### GO

`GO` requires all of the following:

- hard feasibility;
- budget compliance;
- score >= 70;
- no unresolved material cost component;
- evidence supports the displayed price/availability claim;
- the result is not materially uncertainty- or estimate-heavy.

### MAYBE

`MAYBE` covers feasible results scoring at least 45 that do not meet all GO evidence requirements, including estimate-heavy or materially uncertain candidates.

### SKIP

`SKIP` covers hard infeasibility, a hard budget violation, or score < 45. A visually appealing destination cannot average away a failed hard constraint.

## Total-trip cost

WayGo must not rank headline airfare as if it were trip cost. The reference contract keeps material components separate: intercity transport, transfers, lodging with mandatory fees, local transport, activities included in the proposed itinerary, food allowance, known entry charges, and a visible contingency.

A missing material cost remains unresolved; it is never treated as zero. Mixed-evidence totals disclose the weakest material price class. This prevents incomplete candidates from appearing artificially cheap.

## Provider boundary

Provider-specific responses should normalize into provider-neutral evidence before ranking. At minimum preserve provider/external identity, observation time, travel dates, currency, price class, amount/range, freshness/expiry, deep-link/terms context when permitted, and a non-secret provenance pointer.

Provider failure or staleness downgrades evidence. It must not be converted into a current live quote.

## Itinerary boundary

The itinerary generator receives normalized candidates/evidence plus user constraints. Regeneration creates a new revision and preserves historical evidence from prior revisions. The generator cannot upgrade an estimate to a quote or infer a booked state.

V1 remains planning-first: discover, rank, plan, save, refresh/monitor, and deep-link where allowed. Autonomous purchase is not enabled, and a deep-link click is not proof of booking.

## Acceptance vectors now executable

The committed test vectors establish several non-negotiable behaviors before front-end implementation resumes:

1. a complete affordable candidate can become GO;
2. missing material cost cannot be rewarded as cheap and downgrades to MAYBE;
3. a hard budget violation remains SKIP even if experience fit is high;
4. estimate-heavy evidence cannot be labeled GO;
5. a weak candidate below the scoring threshold is SKIP.

These tests are portable and should move unchanged into the future dedicated WayGo repository before implementation diverges.

## Current implementation boundary

The authoritative Hostinger source/export remains unrecovered in the non-interactive environment, so this change does **not** edit the live site, invent routes/screens, add itinerary tables, alter the verified Supabase schema, or claim any live provider integration. Source recovery remains the gate before production UI/schema implementation.
