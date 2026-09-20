# Onboarding trust contract v1

Implements Phase 1 of `docs/ADAPTIVE-ONBOARDING-TRUST.md`.

The runtime source of truth is `runtime/onboarding-trust.js`. This document makes
its product consequences explicit so onboarding questions cannot become
collection-without-purpose and UI state cannot outrun authoritative evidence.

## Question → downstream effect

| Onboarding answer | Required downstream effect |
| --- | --- |
| `primaryWorkArea` | Select recommended industry pack and default workspace layout. |
| `secondaryWorkAreas` | Add workspace modules without replacing the primary pack. |
| `desiredOutcomes` | Select workspace modules and prioritize the connection plan. |
| `existingTools` | Build the provider/capability connection plan; inventory alone grants no authority. |
| `startingState` | Select whether the first workflow improves existing work, creates new work, or supports both. |
| `presentationPreferenceIds` | Select a known workspace-layout preference ID; never infer access authority from a visual preference. |
| `authorityProfile` | Map to an enforceable policy-contract ID and default approval posture. |

The recommendation function is deterministic. AI may explain a recommendation
but cannot broaden scopes, grant authority, or silently change a policy contract.

## Canonical truth states

### Connection

`available`, `ready_to_connect`, `authorization_in_progress`, `connected`,
`verified`, `needs_attention`, `unavailable`.

`connected` requires backend evidence containing an authorization timestamp and
provider account identity. `verified` additionally requires independent
verification evidence. A button click, optimistic frontend state, network
reachability, or OAuth window opening is never enough.

### Action

`proposed`, `approved`, `executing`, `completed`, `failed`, `verified`, `rejected`.

### Information

`simulated_preview`, `live`, `last_updated`, `stale`, `unavailable`.

A simulated preview remains explicitly simulated until a capability supplies live
source evidence.

## Reachability is not authority

Network reachability (including a node being reachable through Tailscale) is a
transport fact. Capability authority is a separate policy fact with explicit
read/write/destructive-write values. A reachable node receives no implicit
provider permission.

## Authority profiles

- `review_first`: connected reads allowed; writes require approval; destructive writes require approval.
- `assist_automatically`: connected reads allowed; bounded low-risk writes may execute automatically; destructive writes still require approval.
- `custom`: read/write actions require explicit policy rules; destructive writes require approval.

These are defaults, not a bypass around connector scopes, provider policy, or
higher-level organizational controls.

## Contextual permission explanation

Before authorization, the product contract requires all of: capability being
unlocked, requested access (`read_only` or `read_write`), what OpenRabbit will do,
what it will not do, why access is requested at that moment, and the disconnect
or authority-change path.

## Resumability and privacy lifecycle

Profiles are versioned, revisioned, and tenant/user scoped. Revisit preserves
identity and prior categorical answers while recalculating deterministic
recommendations. Reset removes answers/recommendations and returns to the first
step. Export returns a detached copy. Delete returns only a minimal identity
+tombstone record so removed preferences are not retained in the active profile.

## Privacy-safe trust analytics

Analytics uses an explicit event-name and field allowlist. Payload keys matching
content, bodies, messages, prompts, tokens, secrets, passwords, authorization
material, cookies, credentials, or file text are rejected. Arbitrary dimensions
are rejected as well; adding a metric therefore requires an intentional contract
change and review.

Tracked event families cover onboarding progress, preview use, connection
transitions/recovery, permission explanations, authority-profile choice, first
verified connection/win, reset, export, and deletion. Events describe transitions
and categorical IDs—not customer email, CRM, file, message, or prompt content.

## Verification expectations

`tests/onboarding-trust.test.js` locks the Phase 1 boundaries: every question has
a downstream effect, Connected/Verified cannot be produced from frontend intent,
network reachability grants no authority, permission explanations are complete,
analytics rejects sensitive/unapproved payloads, profile revisit/reset/export/
delete works, and a revisit cannot move a profile across tenants or users.
