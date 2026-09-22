# WayGo app implementation specification V1

Status: portable implementation target pending authoritative Hostinger front-end recovery. GitHub remains the technical source of truth for product logic. This specification defines service/data behavior and acceptance boundaries without reconstructing or replacing the unrecovered production UI.

## Product loop

WayGo begins with **“Where to next?”** The user supplies an origin, traveler count, total budget/currency, available time, and a date or flexibility window. A destination is optional.

The V1 loop is:

1. normalize hard trip constraints;
2. discover candidate destinations/deals through provider adapters;
3. reject hard-infeasible candidates before preference scoring;
4. build a componentized total-trip-cost envelope;
5. rank candidates with `waygo_rank_v1`;
6. generate a day-by-day itinerary from normalized evidence;
7. preserve ranking/cost/evidence versions with the itinerary revision;
8. save, refresh/monitor, export/share, or deep-link where permitted.

V1 is planning-first. It does not autonomously purchase travel, and a deep link never implies a booking.

## Logical architecture

### Constraint service

Input contract:

- origin;
- travelers and traveler-type constraints when known;
- total budget and currency;
- available time / maximum trip duration;
- fixed dates or flexibility window;
- optional interests, pace, accessibility, lodging preferences, passport/entry constraints, and destination exclusions.

Output: normalized immutable search constraints plus a constraint-version identifier.

### Discovery orchestrator

The orchestrator fans out to provider-neutral adapters under explicit search budgets and timeouts. It deduplicates destination/offer candidates and never passes raw vendor objects directly into ranking or itinerary generation.

Provider failure degrades only the affected evidence surface where possible. A failed provider must not be represented as an empty/zero price or a current quote.

### Provider adapter contract

Every normalized evidence record should expose at least:

- provider and external identifier;
- evidence category (`transport`, `lodging`, `activity`, `ground_transport`, `food_reference`, `entry_requirement`, `map_or_time`);
- observed/fetched timestamp;
- applicable travel dates;
- currency;
- amount or amount range when applicable;
- price class and freshness/expiry;
- availability/terms context when supplied by the provider;
- deep link when contractually permitted;
- non-secret provenance pointer;
- provider-specific raw reference retained outside ranking logic when required for reconciliation.

### Total-trip-cost engine

The canonical machine contract is `docs/waygo/contracts/waygo_total_trip_cost_v1.json`.

Required material components are intercity transport, transfers, lodging with mandatory fees, local transport, included itinerary activities, food allowance, known entry charges, and contingency. Each component preserves low/expected/high amounts plus evidence state.

Budget compliance is conservative: it is true only when no required material cost is unresolved and the **upper-bound total** is at or below the user's unchanged budget. Unknown material cost is never zero.

### Ranking engine

The canonical contract is `docs/waygo/contracts/waygo_rank_v1.json`.

Hard feasibility precedes scoring. Feasible candidates are scored on affordability/headroom, usable-time efficiency, experience fit, itinerary coherence, and evidence quality, with an explicit uncertainty penalty. GO/MAYBE/SKIP is a product classification over those transparent factors, not a hidden model recommendation.

### Itinerary generator

The generator receives only normalized constraints, the selected candidate, normalized provider evidence, total-trip-cost evidence, and geography/time information. It may sequence and summarize; it may not invent a live quote, infer that something was purchased, or erase source/freshness information.

A generated plan should include:

- itinerary revision ID;
- destination and trip dates;
- daily blocks with local time and approximate transit buffers;
- evidence-backed activities/places;
- per-day and trip-level cost references;
- cost revision ID;
- ranking version and selected-candidate score factors;
- warnings/unknowns that materially affect feasibility;
- booking state kept separate from itinerary state.

Material itinerary changes require a new cost calculation and a new revision; historical price evidence remains immutable.

## Persistence target

The verified existing `waygo_passport` and `waygo_favorites` tables remain separate from itinerary lifecycle state. Do not overload passport status with itinerary status.

When authoritative front-end recovery is complete, the first itinerary persistence design should model at minimum:

- itinerary identity/owner;
- immutable revision number;
- constraint version;
- candidate/ranking version and factor scores;
- cost revision and component evidence references;
- itinerary lifecycle (`draft`, `ready`, `active`, `completed`, `archived`);
- orthogonal booking state (`not_booked`, `partially_booked`, `booked`) supported only by user or trusted provider evidence;
- generation timestamp and last refresh timestamp;
- provider/provenance pointers without secrets.

Schema creation remains gated until the recovered production UX is mapped against this lifecycle.

## API/service surface target

The portable service boundary should support behaviors equivalent to:

- create/normalize trip request;
- discover candidates;
- get ranked candidates with explainable factor scores;
- generate itinerary from one selected candidate;
- create a new itinerary revision;
- refresh material price/availability evidence;
- save/favorite/passport interactions through owner-scoped persistence;
- export/share without exposing private provider tokens or raw customer data;
- return truthful partial/error states when providers fail.

Exact public routes, component names, and screen layouts must be recovered from the authoritative front end rather than invented here.

## Required UI states

Regardless of visual design, the recovered app should have explicit behavior for:

- first-use / no saved trips;
- search in progress;
- partial provider results;
- insufficient evidence;
- GO/MAYBE/SKIP explanation;
- over-budget candidate exploration without relabeling as GO;
- itinerary generation/regeneration;
- stale-price refresh required;
- provider outage/rate limit;
- signed-out / expired session;
- save/export/share success and failure;
- no-booking-evidence state after deep-link navigation.

## Acceptance suite before launch

A launch candidate should prove at least:

1. missing lodging/fees cannot make a destination look artificially cheap;
2. an unresolved material cost cannot produce a budget-compliant GO;
3. a complete trip whose upper-bound total exceeds budget is not GO;
4. stale/provider-failed evidence cannot be promoted to a live price;
5. itinerary regeneration preserves prior revision evidence;
6. a deep-link click does not change booking state without trusted evidence;
7. two authenticated users cannot read or mutate each other's passport, favorites, or future itinerary records;
8. provider tokens/secrets never enter client-visible provenance or exported itineraries;
9. refreshes are idempotent and do not duplicate saved itinerary revisions unintentionally;
10. at least one known reference itinerary can be replayed end-to-end with deterministic contract assertions.

Executable ranking and cost-contract tests already live in the OpenRabbit-Platform root test suite and should migrate unchanged into the future dedicated WayGo repository.

## Commercial/launch gate

Before representing WayGo as production-ready, require:

- authoritative front-end source/export recovery and version control;
- dedicated WayGo repository and CI;
- mapped auth/network/environment dependencies;
- itinerary persistence implemented behind owner-scoped access controls;
- live provider commercial terms, attribution, rate limits, deep-link/booking rights, and data-retention rules reviewed;
- privacy policy and terms aligned to actual collected data and provider sharing;
- clear distinction between estimates, current quotes, and booked reservations;
- analytics/error monitoring plus provider freshness/error telemetry;
- mobile acceptance coverage and accessibility review;
- incident, support, rollback, and data-deletion procedures;
- no autonomous purchase path unless separately designed, authorized, and reviewed.

## Current blocker

The authenticated interactive Hostinger builder/export path is not available in this automation environment. No live WayGo website change is claimed by this specification. Source recovery remains the prerequisite for visual/UI implementation and production route/schema changes.
