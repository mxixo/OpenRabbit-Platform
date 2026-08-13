# Living Agenda by OpenRabbit

## Product position

Living Agenda is an independently deployable consumer product built on reusable OpenRabbit planning and execution intelligence.

OpenRabbit is the broader AI operating environment for businesses, teams, AI workers, tools, runtimes, approvals, integrations, industry packs, and organizational command. Living Agenda is the focused personal execution product that helps a person turn chosen goals into realistic plans, stay aligned as reality changes, learn how they actually operate, and progressively improve their ability to execute without treating maximum workload as the objective.

Living Agenda may be distributed as its own application while also remaining a native capability inside the broader OpenRabbit environment.

## Product promise

Help people make more progress toward the life they choose, with greater clarity, consistency, resilience, and capability than they would have achieved without an adaptive execution plan.

Productivity is the mechanism. Life improvement is the intended outcome.

A successful Living Agenda may help a user accomplish more, but it may also help an overworked user accomplish the same meaningful outcomes in less time and reclaim time for rest, relationships, health, recreation, or other chosen priorities.

## What Living Agenda is

Living Agenda is an execution coach and adaptive personal operating layer. It should continuously answer:

- What matters now?
- What should happen next?
- What changed since the plan was created?
- Is the remaining plan still realistic?
- Is current behavior aligned with declared goals?
- What is blocking progress?
- How quickly does the user recover after disruption?
- What is the user's current reliable capacity?
- Is that capacity improving over time?
- Is the current pace sustainable within the life and boundaries the user chose?
- Could the same meaningful outcomes be achieved with less time, friction, context switching, or unnecessary work?

It is not merely a calendar, task manager, streak tracker, or generic motivational coach.

## Relationship to OpenRabbit

### OpenRabbit

Primary business/platform scope:

- AI operating environment
- human and AI teams
- departments and organizational goals
- runtime providers and workers
- tools, MCPs, integrations, and industry packs
- approval and audit systems
- organizational execution intelligence
- CEO attention and command surfaces

### Living Agenda

Primary consumer/personal scope:

- personal goals and outcomes
- adaptive daily planning
- accountability and execution check-ins
- behavioral learning
- personalized duration and capacity estimates
- interruption and recovery awareness
- sustainable capacity growth
- well-being-aware planning
- personal progress and execution maturity

### Shared intelligence

Both products should reuse the same normalized concepts where appropriate:

- goals and outcomes
- plans and plan items
- priorities and explanations
- execution events
- blockers and dependencies
- completion and approval state
- capacity
- drift
- reconciliation
- audit/history

The consumer product must not depend on real-estate-specific or organization-only concepts in order to run.

## Independently deployable rule

Living Agenda must be able to ship as a standalone application without requiring the complete OpenRabbit business UI or an OpenClaw runtime.

The standalone app may call shared OpenRabbit services/packages, but its product boundary must remain clear enough that it can have its own:

- onboarding
- authentication surface
- goal setup
- daily agenda UI
- notification/check-in experience
- consumer subscription/pricing
- analytics and privacy controls
- App Store / mobile distribution

The OpenRabbit business product may embed or extend the same Living Agenda engine for organizational planning.

## Core loop

Goal -> Plan -> Execute -> Observe -> Learn -> Adapt -> Grow

Well-being and user authority constrain the entire loop.

### Goal

The user declares desired outcomes and priorities. OpenRabbit should not decide what constitutes a good life.

### Plan

Living Agenda converts goals, commitments, available time, dependencies, estimated effort, and learned capacity into an explainable agenda.

### Execute

The user or an authorized worker acts on the plan.

### Observe

The system records execution events rather than relying only on final task state.

### Learn

The system learns task-specific pace, adherence patterns, interruption patterns, recovery behavior, capacity, recurring friction, and opportunities to reduce wasted time.

### Adapt

The remaining agenda is reconciled when reality changes.

### Grow

The system can gradually challenge reliable capacity when evidence suggests the user can sustainably handle more. Growth can also mean becoming more selective, reducing unnecessary work, improving recovery, or achieving the same outcomes with less time.

## Execution event model

Completion is not a single timestamp. The product should preserve enough event data to distinguish actual execution from delayed reporting.

Candidate timestamps include:

- `scheduledStartAt`
- `scheduledEndAt`
- `checkInPresentedAt`
- `respondedAt`
- `reportedCompletionAt`
- `nextAgendaViewedAt`

This supports analysis of agenda continuity and recovery without assuming that a late swipe means the task itself took longer.

## Frictionless accountability interaction

A primary mobile interaction may use a binary swipe check-in:

- swipe right: completed
- swipe left: not completed
- immediate undo: correct an accidental response

The swipe should answer the immediate question with minimal friction. Follow-up interrogation should be selective.

Repeated or strategically important misses may trigger lightweight context options such as:

- task ran long
- unexpected event
- blocked
- needed a break
- priorities changed
- forgot to check in
- reschedule
- delegate
- drop/deprioritize

Corrections must also correct the behavioral history used for learning.

## Agenda continuity and recovery

Living Agenda should distinguish:

Plan -> Execution -> Interruption -> Response -> Recovery -> Result

A disruption is not inherently a failure. The system should learn how often and how effectively the user returns to intentional work after disruption.

Potential signals include:

- time from scheduled completion to check-in
- time from interruption to next agenda view
- number of consecutive plan items followed before continuity breaks
- recovery latency
- repeated time-of-day breakdown patterns
- categories of work most associated with agenda abandonment

These signals should be interpreted probabilistically and should not assign motive without evidence.

## Personalized pace and capacity

Do not maintain a simplistic global "user speed" score.

Duration prediction should become contextual over time, using signals such as:

- task category
- task complexity
- familiarity
- estimated effort
- actual duration
- interruptions
- time of day
- completion outcome
- prior performance on comparable work

The planning model should distinguish:

### Baseline
What can this user reliably execute today?

### Capacity
How much can reasonably fit into the current agenda without creating a fantasy plan?

### Growth
Can challenge increase gradually while preserving meaningful adherence and well-being?

The desired behavior resembles progressive overload: establish reliable capacity, add an appropriate challenge, observe adaptation, then adjust.

Speed is not itself the objective. Higher throughput with collapsing adherence or well-being is not necessarily progress.

## Time freedom and overwork

Living Agenda should be capable of helping an overworked user slow down without abandoning ambition.

The system should search not only for ways to fit more work into available time, but also for opportunities to reduce the time required to achieve the user's chosen outcomes.

Potential opportunities include:

- eliminating low-value work
- batching similar work to reduce context switching
- delegating appropriate tasks
- automating repetitive work
- protecting focused work periods
- identifying meetings or routines with low observed value
- improving duration estimates so schedules stop overflowing
- preserving recovery and rest before performance deteriorates
- identifying when additional effort produces little additional strategic progress

A useful optimization question is:

> Can the user preserve or improve meaningful outcomes while spending less of their life on avoidable work?

For some users, improvement means greater productive capacity. For others, improvement means maintaining output while reclaiming hours of personal time. Both are legitimate forms of progress.

The planner should therefore consider a time-efficiency dimension alongside throughput. It should not automatically refill every hour that optimization frees.

## Well-being constraint

Living Agenda should optimize for meaningful progress at a sustainable level of effort, not maximum output.

Planning and behavioral models should consider three simultaneous questions:

1. Progress: Are we moving toward what matters?
2. Capacity: What can this person realistically execute now?
3. Sustainability: Is this pace compatible with the life and boundaries they chose?

A fourth optimization question may be useful:

4. Efficiency: Can comparable outcomes be achieved with less avoidable time or friction?

The product should not prescribe a universal definition of balance. Users define goals, constraints, relationships, rest, health, work, and other priorities that matter to them.

Rest may itself be part of an intentional plan.

## Anti-exploitation principle

Behavioral intelligence exists to serve the person whose behavior is being modeled, not to extract maximum labor from them.

Living Agenda and shared OpenRabbit execution intelligence must not be designed as covert worker-surveillance, coercive productivity scoring, or a mechanism for an employer to infer private personal behavior.

Personal behavioral signals such as pace, recovery latency, missed personal goals, well-being constraints, private routines, and execution-maturity observations should remain private by default.

Organization products may measure legitimate organization-owned workflow state, task outcomes, blockers, approvals, and operational latency, but should not silently convert personal Living Agenda telemetry into employee rankings or managerial surveillance.

If personal information is ever shared across scopes, the user should understand what is shared, why it is shared, and be able to control that sharing where practical.

Optimization should never interpret newly freed time as automatically available for additional employer-assigned work.

## Execution maturity instead of points

Do not make raw points or app engagement the core reward system.

If a progression layer is introduced, prefer demonstrated execution maturity based on sustained behavior. Potential dimensions include:

- consistency
- strategic alignment
- resilience/recovery
- capacity growth
- realistic planning
- follow-through
- life alignment
- ability to reduce unnecessary effort while preserving outcomes

Levels should not reward task inflation, trivial busywork, excessive app opens, or unhealthy workload.

A high execution-maturity user may intentionally complete fewer tasks while consistently advancing important goals and maintaining chosen life priorities.

## Behavioral drift

Living Agenda should identify contradictions between declared priorities and repeated behavior without automatically moralizing them.

Example:

- declared goal: high priority
- related strategic task: postponed repeatedly
- lower-value work: repeatedly displaces it
- intervention: surface the divergence and request a decision

Possible decisions:

- recommit
- change the plan
- reduce scope
- delegate
- deprioritize
- revise the goal

The objective is to prevent stale goals and stale tasks from being carried forward forever without reflection.

## Consumer and organization symmetry

Personal execution and organizational execution share structural patterns.

Personal:

Goal -> Project -> Plan Item -> Execution -> Blocker -> Recovery -> Result

Organization:

Strategic Goal -> Initiative -> Department/Worker -> Task -> Blocker/Approval -> Recovery -> Result

Living Agenda should prove and refine reusable execution intelligence at the individual scope. OpenRabbit can apply related models at organization scope without forcing consumer users to understand enterprise concepts.

## Product categories

Living Agenda may naturally sit across:

- Productivity
- Health & Wellness
- Personal Development

OpenRabbit remains primarily a business/productivity platform.

Category placement should follow actual product capabilities and distribution requirements rather than forcing the product into a single conceptual box.

## Product funnel hypothesis

A possible long-term path is:

Individual -> Entrepreneur -> Team -> Organization

A person may begin with Living Agenda for personal execution and later adopt OpenRabbit as their work becomes organizational. This is a product opportunity, not a requirement for Living Agenda usage.

## Architectural guardrails

1. Living Agenda remains independently deployable.
2. Core planning intelligence remains provider-neutral.
3. Calendar providers are inputs/surfaces, not the source of truth for intelligence.
4. User authority remains explicit.
5. Behavioral observations must not be presented as certainty about motivation.
6. Corrections/undo must propagate into learned behavioral history.
7. Well-being and chosen constraints must not be silently optimized away.
8. Engagement metrics must not replace outcome quality.
9. Enterprise-specific concepts must not leak into the consumer core unnecessarily.
10. Shared execution intelligence should remain reusable by OpenRabbit organization products.
11. Personal behavioral intelligence remains private by default and must not become covert employee-surveillance data.
12. Time saved through optimization must not automatically be treated as capacity to refill with more work.
13. Reducing unnecessary work while preserving outcomes is a valid success state.

## Near-term implementation implications

The current Living Agenda core work should continue toward:

1. execution event contracts with distinct scheduled/presented/responded/completed timestamps
2. reversible swipe/check-in events
3. agenda continuity and recovery metrics
4. contextual duration observations and personalized estimates
5. capacity/baseline models
6. repeated deferral and behavioral drift detection
7. well-being and time-freedom constraint contracts
8. execution maturity model as a later optional layer

These should be implemented as reusable core capabilities before committing to a specific consumer UI framework.