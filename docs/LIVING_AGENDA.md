# Living Agenda

The **Living Agenda** is OpenRabbit's adaptive planning and operating layer.

It is not simply a calendar view or a task list. It is a continuously updated representation of what should happen next, why it matters, who owns it, how it connects to goals, and what changed as work progressed.

## Core idea

A traditional calendar records scheduled events. A Living Agenda interprets commitments, goals, dependencies, worker activity, deadlines, approvals, and results to maintain an actionable plan.

The agenda should answer, at any moment:

- What matters most right now?
- What should happen next?
- What is on track, at risk, blocked, skipped, or complete?
- Which goal, project, department, or outcome does this work support?
- Who owns the next action: the user, a human teammate, or an AI worker?
- What changed since the plan was last generated?
- Does the remaining schedule still make sense?

The calendar is one input and one presentation surface. The normalized OpenRabbit plan remains the source of operating state.

## Two primary operating modes

### 1. Personal / Goal Alignment

The Living Agenda can function as an execution-oriented life and performance coach.

It should connect long-range goals to weekly and daily actions, surface drift between stated goals and actual behavior, and continuously revise the day as reality changes.

Example:

```text
Goal: Build OpenRabbit MVP
  -> Weekly outcome: finish planning execution bridge
     -> Today: review PR, resolve CI, merge feature

Goal: Improve fitness
  -> Weekly outcome: complete four training sessions
     -> Today: upper-body workout at 6:30 PM
```

The system should be supportive but evidence-based. It should not merely congratulate activity; it should be able to show that a user's current allocation of time is or is not consistent with declared goals.

Possible behaviors:

- morning plan generation;
- priority ranking based on goals, urgency, value, deadlines, energy, and dependencies;
- reminders of why a task matters;
- rescheduling when tasks run long, finish early, or are skipped;
- identification of repeated avoidance or schedule overload;
- end-of-day reconciliation between planned and actual work;
- weekly goal-progress review;
- suggested removal or deferral of low-value commitments.

### 2. Organization / CEO Command View

The same planning engine can represent an organization rather than one person's day.

The CEO view should summarize what is happening across departments, workers, projects, approvals, and external commitments without forcing the user to inspect every underlying task.

Example:

```text
OpenRabbit Organization

Acquisitions
  3 properties under review
  1 underwriting completed
  1 outreach action awaiting approval

Research
  Phoenix multifamily market brief in progress

Marketing
  4 social posts scheduled
  Instagram publish blocked by integration issue

Operations
  2 follow-ups overdue

CEO Attention
  Approve investor outreach
  Review high-scoring acquisition
  Resolve Instagram publishing dependency
```

The organization view is therefore not a separate product concept. It is the Living Agenda operating at a broader scope.

## Shared planning model

Personal and organizational modes should use the same underlying concepts:

- Goals / outcomes
- Plans
- Plan items
- Owners
- Workers
- Tasks
- Dependencies
- Deadlines
- Priorities
- Status
- Approvals
- Audit history
- Source events
- Notes / results

This avoids creating separate personal-planning and enterprise-planning engines.

## Living behavior

The defining characteristic is **continuous reconciliation**.

A plan should change when its assumptions change.

Examples:

- A task finishes 45 minutes early -> pull the next high-value item forward.
- A meeting is added -> recompute the remaining agenda.
- An AI worker completes research -> mark the linked agenda item complete and surface the result.
- A consequential worker action needs approval -> mark the item blocked and elevate it to the CEO attention queue.
- An approval is granted -> resume execution and update the item automatically.
- A deadline moves -> reprioritize dependent work.
- A user repeatedly skips a goal-aligned task -> surface the pattern rather than endlessly rescheduling it without comment.
- A department accumulates blocked work -> elevate the blockage to the organizational view.

## Planning hierarchy

A useful target hierarchy is:

```text
Mission / Life Direction
  -> Goal
     -> Outcome / Milestone
        -> Project / Initiative
           -> Daily Plan
              -> Plan Item
                 -> Human action or Worker Task
                    -> Result / Approval / Audit event
```

Not every customer needs every level. The model should permit lightweight usage while retaining the deeper hierarchy.

## Priority model

Initial ranking should be explainable rather than opaque.

Possible factors:

- goal alignment;
- urgency / deadline proximity;
- expected value / impact;
- dependency importance;
- opportunity cost;
- estimated duration;
- available time window;
- human vs AI ownership;
- blocked / approval state;
- user-defined priority;
- recurrence / habit commitments;
- schedule constraints.

The system should preserve the factors used to produce a recommendation so the interface can answer, "Why is this first?"

## Human authority

The Living Agenda can recommend, reorder, dispatch read-only analysis, and update operating state automatically within policy.

Consequential actions remain subject to OpenRabbit's approval model. The agenda should expose approvals as part of the flow rather than hiding them in a separate administrative surface.

The user remains able to override priorities, skip work, alter goals, or change the plan. Overrides become additional information for future planning; they should not silently disappear.

## Provider neutrality

Google Calendar, Microsoft Outlook, task managers, CRM systems, and other sources should connect through adapters.

OpenRabbit should normalize external events into plan inputs and sync selected state back out, but no provider should own the Living Agenda model.

```text
Calendar / CRM / Tasks / Email / Workers
                |
                v
        Normalization adapters
                |
                v
          Living Agenda Engine
                |
        +-------+--------+
        |                |
        v                v
 Personal View       CEO / Org View
        |                |
        +-------+--------+
                |
                v
       Workers / Humans / Approvals
                |
                v
        Results + Reconciliation
```

## Near-term implementation sequence

1. Core daily-plan and plan-item contracts. **Implemented.**
2. Provider-neutral plan API. **In progress.**
3. Planning-enabled platform backend. **In progress.**
4. Plan-item -> worker execution bridge. **In progress.**
5. Plan-item execution API. **In progress.**
6. Goal / outcome contracts and plan-item goal links.
7. Explainable priority scoring.
8. Daily-plan generator from normalized commitments.
9. Reconciliation / automatic reprioritization engine.
10. CEO attention queue and department rollups.
11. Calendar ingestion and sync adapters.
12. Durable persistence and event-driven scheduling. **JSON-file planning persistence implemented for local/small deployments; production database and event scheduling remain.**

## Product principle

**The agenda is not a static promise about the day. It is OpenRabbit's current best operating plan based on goals, commitments, available resources, and what has actually happened.**


## Durable local planning state

`JsonFileCalendarPlanStore` provides a VPS-independent persistence adapter for
local development and small single-process deployments. It preserves normalized
plan items, execution status and notes, daily plans, source references, and
metadata across process restarts.

Writes use a temporary file followed by an atomic rename. Snapshot exports are
versioned and can be imported into another installation, providing a portable
backup and a migration path before a production database is introduced.

Example composition:

```ts
const planningStore = new JsonFileCalendarPlanStore({
  filePath: ".openrabbit-data/living-agenda.json"
});
const backend = new PlanningRealEstatePlatformBackend(planningStore);
```

Local state under `.openrabbit-data/` is intentionally excluded from Git. The
adapter targets a single running process. Multi-process production deployments
will require a transactional database adapter behind the same
`CalendarPlanStore` interface.
