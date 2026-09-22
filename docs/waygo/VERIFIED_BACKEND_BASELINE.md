# WayGo verified backend baseline

Status: source-recovery support artifact. This document records the currently verified Supabase boundary without claiming anything about the unrecovered Hostinger front end.

Verified against Supabase project `zwrsapkgdfsvvaoefhqf` (`WayGo`) on 2026-09-21. The project reported `ACTIVE_HEALTHY`; current Supabase security and performance advisor scans returned zero findings.

## Public schema currently verified

Only two public application tables are present.

### `public.waygo_favorites`

- `id uuid` primary key, default `gen_random_uuid()`
- `user_id uuid` → `auth.users(id)`
- `idea_key text`, length 3–201
- `destination text`, trimmed length 1–120
- `country text`, trimmed length 1–80
- `created_at timestamptz`, default `now()`
- unique `(user_id, idea_key)`
- RLS enabled

Authenticated RLS policies are owner-scoped:

- `own_favorite_read`: `auth.uid() = user_id`
- `own_favorite_insert`: `WITH CHECK auth.uid() = user_id`
- `own_favorite_delete`: `auth.uid() = user_id`

There is intentionally no verified UPDATE policy at this baseline. A recovered front end must not be assumed to update favorite rows in place until its actual mutation path is inspected.

### `public.waygo_passport`

- `id uuid` primary key, default `gen_random_uuid()`
- `user_id uuid` → `auth.users(id)`
- `destination text`, trimmed length 1–120
- `country text`, trimmed length 1–80
- `status text` constrained to `planned | visited`
- `visit_date date`, nullable
- `visited_confirmed boolean`, default `false`
- `created_at timestamptz`, default `now()`
- index `(user_id, created_at DESC)`
- RLS enabled

Authenticated RLS policies are owner-scoped for SELECT, INSERT, UPDATE, and DELETE. UPDATE applies the same owner predicate to both `USING` and `WITH CHECK`.

## What is **not** verified

No persistent itinerary, booking, quote, fare, lodging, activity, trip-ranking, or payment table is currently present in the public schema. The absence of those tables is not evidence that the Hostinger front end has no transient/local/browser implementation; it means the current Supabase backend does not establish a durable contract for those concepts.

Do not infer or create itinerary persistence from product memory alone. The authoritative Hostinger front-end/builder baseline must be recovered first so routes, auth assumptions, network calls, local-storage behavior, environment variables, and the existing favorite/passport mutations can be mapped to this backend.

## Source-recovery reconciliation checklist

When the authoritative front end becomes accessible, reconcile it against this baseline before any feature work:

1. Inventory every screen/route and identify which actions read or mutate `waygo_favorites` or `waygo_passport`.
2. Confirm the client never supplies another user's `user_id` as an authority mechanism; Supabase Auth + RLS remains the security boundary.
3. Confirm favorite creation/deletion matches the existing no-UPDATE policy and the `(user_id, idea_key)` uniqueness rule.
4. Confirm passport status transitions respect `planned | visited`, and document how `visit_date` and `visited_confirmed` are used.
5. Identify any local-only itinerary/trip state separately from durable backend state.
6. Inventory provider/network dependencies and classify price data as live/bookable, cached/provider-stamped, estimated, or simulated before showing total-trip-cost claims.
7. Only after this reconciliation, create the dedicated WayGo repository and import the reproducible baseline with a route/screen smoke checklist.

## Guardrail

This baseline is evidence, not a target schema. Do not add tables merely to make the backend resemble the intended product. Schema changes should follow the recovered product lifecycle and versioned trip/itinerary contracts, with RLS, provenance, freshness, and transaction controls designed before writes are enabled.
