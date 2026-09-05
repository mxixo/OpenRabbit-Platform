# Adaptive Onboarding and Trust Specification

Status: Proposed  
Product area: Product Experience  
Priority: P1  
Last updated: 2026-09-05

## Goal

OpenRabbit should learn a user's work, desired outcomes, tools, and interface preferences before requesting private connections. It should demonstrate relevant value first, ask for authority progressively, and make connection, permission, execution, and verification state truthful.

## Product principles

1. Personalize before presenting.
2. Ask one consequential question per screen.
3. Demonstrate a believable workflow immediately after role/tool selection.
4. Learn presentation preferences through visual choices, not design jargon.
5. Produce a labeled read-only preview before account or provider authorization.
6. Ask for access only in the context of a capability the user chose.
7. Keep internal plumbing invisible while keeping evidence and system state visible.
8. Use neutral, reversible trust language; no loss-aversion or dark-pattern copy.
9. Progressively earn autonomy through existing policy and approval contracts.
10. Never represent simulated, aspirational, or unverified information as live.

## Proposed flow

1. **Work identity:** Real Estate, Business, City/Public Service, Personal, or Configure with AI.
2. **Desired outcomes:** deadline awareness, lead/deal movement, decision preparation, content/outreach, cross-device operation.
3. **Existing tools:** inventory only; no authorization yet.
4. **Starting state:** improve existing, create new, or both.
5. **Presentation preferences:** select up to three OpenRabbit workspace examples.
6. **Personalized proof:** labeled simulated workspace, first workflow, required connections, approval points, expected outcome.
7. **Account/workspace:** save the configuration with neutral skip language where feasible.
8. **Progressive connections:** one provider at a time with plain-language scope and reversibility.
9. **Authority profile:** Review first, Assist automatically, or Custom.
10. **First verified win:** complete a bounded workflow and show evidence.

## Trust-state vocabulary

### Connections

- Available
- Ready to connect
- Authorization in progress
- Connected
- Verified
- Needs attention
- Unavailable

A UI action alone must never produce **Connected** or **Verified**. Those states require authoritative backend evidence.

### Actions

- Proposed
- Approved
- Executing
- Completed
- Failed
- Verified
- Rejected

### Information

- Simulated preview
- Live
- Last updated
- Stale
- Unavailable

## Contextual permission explanation

Before provider authorization, show:

- capability unlocked;
- requested access in plain language;
- read-only versus write authority;
- what OpenRabbit will and will not do;
- why access is requested now;
- how to disconnect or change authority.

Tailscale/network reachability remains separate from OpenRabbit capability authority.

## Technical contracts

### Onboarding profile

Use a versioned schema containing:

- primary work area and optional secondary areas;
- desired outcomes;
- existing-tool inventory;
- starting-state choice;
- presentation preference IDs;
- recommended industry pack and workspace layout;
- recommended connection plan;
- selected authority profile;
- onboarding step/version/timestamps;
- preview/first-win state.

Do not store free-form private content when categorical preferences are sufficient.

### Recommendation engine

Start deterministic. Each question must visibly change a recommendation, workspace decision, or connection plan. AI may explain recommendations but must not grant scopes, broaden authority, or overwrite policy.

### Resilience and accessibility

- Resume interrupted onboarding.
- Preserve answers when navigating backward.
- Support keyboard numbers and Enter, touch, visible focus, screen readers, and reduced motion.
- Allow users to revisit, reset, export, or delete onboarding preferences.

### Privacy-safe analytics

Measure events and transitions—not customer email, CRM, file, message, or prompt content.

Core metrics:

- start-to-preview completion;
- median time to preview;
- preview-to-account conversion;
- first verified connection;
- time to first verified win;
- seven-day return;
- connection failure/recovery;
- permission comprehension;
- recommendation usefulness;
- incorrect Connected-state incidents (target: zero).

## Acceptance criteria

- [ ] Personalized preview is reachable without a private connection.
- [ ] Every question changes an observable downstream result.
- [ ] Authorization requests appear only in capability context.
- [ ] Connection state is backend-verified.
- [ ] Simulated and live data are unmistakably different.
- [ ] Back/resume does not lose choices.
- [ ] Keyboard, touch, reduced-motion, and screen-reader flows pass.
- [ ] Authority profiles map to enforceable policy contracts.
- [ ] First workflow displays evidence, action state, and verification.
- [ ] Analytics exclude provider secrets and customer content.

## Phases

1. Contract, truthful states, permission model, and analytics taxonomy.
2. Adaptive questions, visual preference selection, and personalized preview.
3. Progressive OAuth, verification, recovery, and permission review.
4. First verified win using the action queue, node router, audit, and verification.
5. Measure activation/trust and refine without dark patterns.

## Dependencies

- OpenRabbit account identity
- Industry packs
- Connection Gateway
- Policy profiles
- Action queue
- Node registry and capability-aware routing
- Audit and verification contracts

## Inspiration boundary

General interaction concepts were studied from [21st.dev](https://21st.dev/) and its onboarding quiz on 2026-09-05. Do not copy proprietary components, imagery, code, or trade dress.
