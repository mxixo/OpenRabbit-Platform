# Living Agenda Personal Signal Layer

## Purpose

The Personal Signal Layer is the provider-neutral sensory boundary for Living Agenda. It allows the execution coach to learn from authorized calendars, user statements, execution check-ins, task reflections, health/wellness sources, wearable interfaces, schedule changes, and future integrations without allowing any single external provider to become the source of truth for the user's life.

The goal is not maximum data collection. The goal is minimum useful sensing: collect only signals that materially improve planning, execution, recovery, or user-selected outcomes.

## Core flow

External/User Source -> Signal Adapter -> Normalized Signal -> Interpretation -> Proposed Agenda Effect -> User/Core Policy -> Living Agenda State

Signals inform the planner. They do not automatically control it.

## Normalized signal contract

Every signal should preserve at least:

- `id`
- `userId`
- `type`
- `source`
- `observedAt`
- `receivedAt`
- `confidence`
- `provenance`
- `permissionScope`
- `payload`
- `correctionOf` when applicable
- `expiresAt` when the signal should not be treated as durable

## Provenance classes

Signals must distinguish how information became known.

### User-stated

The user explicitly communicated the information.

Example: "I am exhausted today."

### User-action

The user performed a meaningful product action.

Example: swipe-right completion check-in.

### Provider-observed

An authorized external system reported a fact within its scope.

Example: a calendar provider reports that a meeting moved from 2 PM to 1 PM.

### Device-observed

An authorized device/wearable reports a measurement or event.

Example: a workout session is recorded by a health platform.

### System-derived

Living Agenda computed an observation from other signals.

Example: evening agenda continuity has broken on four of the last six comparable days.

### AI-inferred

A model proposes an interpretation that is not directly observed.

Example: a recurring context-switching pattern may be contributing to schedule overflow.

AI-inferred signals should generally carry lower default authority than explicit user statements or reliable provider facts and should be presented as hypotheses where relevant.

## Confidence is not truth

`confidence` represents how strongly the system should rely on a signal for a particular decision. It must not be used to transform an inference into an objective fact.

A high-confidence behavioral pattern remains a behavioral pattern, not proof of motive.

## Initial signal types

### UserStatement
Natural-language information voluntarily supplied by the user.

### CalendarCommitment
A normalized calendar commitment or availability block.

### CalendarChange
A change to an existing commitment that may require agenda reconciliation.

### ExecutionCheckIn
Completed/not-completed status plus check-in timing and modality.

### TaskReflection
Optional user-authored context about difficulty, duration, blockers, interruptions, efficiency, or value.

### ScheduleChange
A user- or provider-originated change to today's available capacity.

### Interruption
A known interruption that affected execution.

### Recovery
Evidence that the user resumed intentional agenda execution after disruption.

### GoalUpdate
A user-authorized change to goal, priority, deadline, or desired outcome.

### HealthWellnessSignal
An explicitly authorized planning-relevant signal from a health/wellness source. The core should not assume that every available health datum should be collected.

### WearableInteraction
A lightweight execution interaction originating from a watch or similar device, such as complete, not complete, next, blocked, or a short dictated reflection.

## Health and wellness boundary

Health/wellness connectivity should be opt-in, granular, and purpose-limited.

Living Agenda may use authorized signals to improve planning, such as:

- sleep-related context
- recorded exercise/workout completion
- activity/recovery context
- user-selected health routines

The execution coach should use these signals for scheduling and user-selected wellness goals, not silently convert the product into a medical diagnostic system.

Health-derived signals should remain private by default and must not flow into employer/organization dashboards merely because the same person also uses OpenRabbit Business.

The planner should be able to function without health connectivity.

## Wearable/watch interface

A watch experience should optimize for minimal interaction rather than reproduce the full mobile application.

High-value actions include:

- show current/next plan item
- mark completed
- mark not completed
- mark blocked
- ask "what's next?"
- report "running late"
- dictate a short task reflection
- undo the most recent reversible check-in

Example watch card:

NEXT
Call broker
12:30-12:45

[Done] [Not Done]

Voice/dictation may provide richer context:

"Done, but he didn't answer."

That interaction should create the same normalized execution/reflection events as the phone application.

The watch should reduce the need to open the phone and should not be designed to maximize device engagement.

## Calm-use principle

Living Agenda should feel like a stabilizing layer throughout the day rather than another stream demanding attention.

The desired experience is:

- obvious next action
- minimal navigation
- minimal required data entry
- conversational correction
- low-friction check-ins
- quiet adaptation in the background where authorized
- intervention only when useful
- clear explanations when the plan materially changes

The user should be able to trust that opening Living Agenda will reduce uncertainty rather than create another inbox to manage.

## Attention budget

Signals should not each generate a notification or coaching intervention.

The system should maintain an attention policy that considers:

- consequence of ignoring the signal
- urgency
- reversibility
- user preference
- current focus state where known
- recent intervention frequency
- whether the signal can wait for the next natural check-in

Examples:

Immediate candidate:
A fixed appointment moved and now conflicts with another protected commitment.

Deferred candidate:
The user's average duration for a task category improved modestly this week.

The execution coach should optimize intervention quality rather than intervention count.

## Minimum viable day

The signal layer should support recognizing when today's original capacity assumptions are no longer realistic.

A Minimum Viable Day mode may reclassify remaining work into:

- must protect
- valuable if possible
- safe to move

Entering this mode should not require the system to infer illness, burnout, or motive. It may be triggered explicitly by the user ("today is falling apart") or by a sufficiently clear combination of schedule/capacity changes, with confirmation when appropriate.

## Plan history and explainability

Every material agenda revision should be traceable to the signals and decisions that caused it.

The user should eventually be able to ask:

"Why is my day different from this morning?"

and receive an explanation based on:

Original Plan -> Relevant Signals -> Reconciliation Decisions -> Current Plan

## Privacy and minimization

1. Do not collect a signal merely because a provider makes it available.
2. Request only permissions that support a user-understood feature.
3. Keep personal behavioral and health signals private by default.
4. Separate personal signal stores from organization-owned workflow telemetry.
5. Preserve provenance so organization data cannot masquerade as personal observation or vice versa.
6. Allow correction/deletion policies to propagate to derived behavioral models where practical.
7. Avoid indefinite retention when a signal only has short-term planning value.
8. Do not use newly available signals to expand surveillance without explicit product/user purpose.

## Adapter model

External integrations should implement provider-specific adapters that emit normalized signals.

Potential adapters include:

- calendar providers
- health/wellness platforms
- watch/wearable applications
- voice/transcription surfaces
- task/project systems
- communication systems
- OpenRabbit worker/task events

Adapters should not contain the core prioritization or coaching policy.

## Product success criterion

The signal layer succeeds when Living Agenda feels more natural while requiring less manual maintenance.

More integrations are not automatically better. A useful integration should reduce friction, improve planning accuracy, increase user control, or remove unnecessary interaction.

The long-term experience should feel like the agenda understands enough context to stay useful throughout the day without requiring the user to continuously administer the software.

## Implementation sequence

1. Define normalized signal/provenance contracts in shared core.
2. Map existing execution check-ins and task reflections into signals.
3. Add corrections/undo semantics.
4. Feed signal-triggered changes into agenda reconciliation with explanations.
5. Add attention-budget policy.
6. Add watch interaction contracts independent of a specific watch SDK.
7. Add health/wellness signal contracts independent of a specific health provider.
8. Implement provider adapters only after core privacy and permission semantics are testable.
