# OpenRabbit Vision

**Status:** Canonical product vision  
**Audience:** Humans and AI contributors (Warp, OpenClaw, Antigravity, ChatGPT, and others)  
**Source of truth:** This file and the companion docs linked from `OPENRABBIT_CONTEXT.md`

---

## What OpenRabbit is

OpenRabbit is an **adaptive AI Operating Environment**.

It is software that molds itself around the user rather than requiring the user to mold themselves around the software. OpenRabbit learns enough about a person's goals, organization, responsibilities, industry, tools, permissions, preferences, and ways of working to construct a useful environment and evolve that environment as the user changes.

A useful shorthand is:

> **OpenRabbit is adaptive software that creates an evolving operating environment around each user.**

It is a modular platform where:

- one or more **AI runtimes** can operate
- specialized **AI workers** coordinate work for a business
- **tools, workflows, APIs, MCP servers, databases, and external apps** are composed safely
- the system adapts to the **goals, context, industry, and changing needs** of the end user
- the interface exposes what is useful now without overwhelming the user with every available capability

OpenRabbit is **not**:

- a chatbot
- a single AI agent
- “an OpenClaw product”
- a thin UI wrapper around one model vendor
- a fork-per-industry codebase
- a static dashboard that makes users configure every workflow before receiving value

Customers purchase **OpenRabbit the platform**. OpenClaw is currently one supported **runtime** inside that platform. The environment must remain **runtime-agnostic**.

---

## The problem

Business owners do not need another chat window or another system they must continuously administer.

They need something closer to an operating system for work:

- turn a mission into departments, roles, and goals
- assign specialized workers with clear permissions
- connect existing tools instead of rebuilding them
- run repeatable workflows with approvals and audit trails
- get metrics, reports, and recommendations they can act on
- stay in control of consequential decisions
- reduce configuration burden by allowing the environment to assemble itself from the user's context

Today's software commonly asks the user to learn its vocabulary, configure pipelines, map fields, build automations, organize dashboards, and manually reconcile systems. OpenRabbit reverses that relationship: **the environment should adapt to the user.**

Today's agent demos also collapse when:

- one mega-prompt tries to do every job
- tools and credentials are unbounded
- industry logic is hardcoded into the runtime
- the product cannot swap models, runtimes, or frontends without a rewrite

---

## Mission

Help owners and CEOs run their organizations alongside configurable AI workers—safely, modularly, and in a way that compounds across industries—inside an environment that learns, constructs, and evolves around them.

OpenRabbit should help transform a user's mission and operating context into:

- organized departments and worker roles
- goals and priorities
- workflows and playbooks
- connected systems and native capabilities
- metrics and reports
- recommendations
- **approved** actions

The end user is treated as the **owner / CEO**. OpenRabbit is the operating environment; workers are the specialized staff.

---

## Adaptive environment model

OpenRabbit's core product loop is:

**Understand → Connect → Construct → Observe → Adapt → Act**

1. **Understand** — learn the user's role, organization, region, goals, responsibilities, workflows, preferences, and constraints.
2. **Connect** — discover and permission existing systems through OAuth, APIs, MCP/connectors, imports, and other secure delegated mechanisms.
3. **Construct** — assemble an initial Hub from core capabilities, integrations, workers, workflows, and relevant Industry Packs.
4. **Observe** — learn from actual work, outcomes, changing priorities, and usage patterns within granted permissions.
5. **Adapt** — evolve the environment as the user's business, responsibilities, team, goals, and tools change.
6. **Act** — proactively perform permitted work and route consequential actions through policy and human approval gates.

The design hierarchy is:

**User → Goals → Environment → Capabilities → Tools**

not:

**Tools → Features → Configuration → User**

OpenRabbit may build an increasingly accurate **operational model** of the user—their goals, preferences, relationships, responsibilities, tools, permissions, routines, and ways of working—but it must preserve the boundary between the human and the system. OpenRabbit acts under delegated authority; it does not silently impersonate the user.

---

## Progressive disclosure, not feature overload

OpenRabbit can offer a broad capability surface without presenting every feature to every user.

During onboarding, the system should infer a useful initial environment from ordinary-language answers and connected data. Users should not need to understand APIs, MCP, workflow engines, field mappings, automation builders, or platform architecture to receive value.

Advanced configuration remains available, but the default experience is **complex underneath, simple on the surface, adaptive by default**.

---

## Connect, migrate, or hybrid

When a user already has business systems, OpenRabbit should support three patterns:

1. **Connect** — orchestrate the existing system through delegated authorization and replaceable adapters.
2. **Migrate** — import supported data into an OpenRabbit-native capability when consolidation creates meaningful value.
3. **Hybrid** — preserve specialized systems of record while OpenRabbit becomes the intelligence, orchestration, memory, and action layer above them.

Hybrid should generally be the default when an existing system already works well.

OpenRabbit should prefer delegated authorization such as OAuth over collecting third-party passwords. Secrets and credentials remain bounded by least privilege and the platform's permission model.

---

## Initial wedge

Real estate is the proving ground because the work is high-context, repetitive, relationship-driven, and spread across many systems.

OpenRabbit will deliberately remain real-estate-heavy until one complete lead-to-deal revenue loop is reliable in production. Broader industry support remains an architectural requirement, but it is not allowed to dilute the first commercial proof. See `docs/REAL_ESTATE_FIRST_PRODUCT.md`.

For a real-estate user, adaptive onboarding can learn brokerage/company, region, business model, client types, lead sources, CRM, email/calendar, MLS/property systems, marketing channels, and desired outcomes. The Real Estate Industry Pack then constructs the relevant environment.

Start with lead handling, deal analysis, follow-up, CRM coordination, calendar-driven work, transaction efficiency, marketing support, and reporting.

The CRM is **one capability inside the environment**, not the identity of OpenRabbit. A useful design test is:

> **The user should not work for the CRM; the CRM should work for the user.**

---

## Expansion path

Once the operating primitives and adaptive environment model are reliable, package industry-specific environments for adjacent service businesses. The core stays reusable; vocabulary, workflows, data adapters, policies, worker presets, and onboarding inference change by vertical.

The same onboarding engine that understands a Phoenix real-estate agent should eventually be able to understand a roofing company, law office, service business, or other organization and construct a materially different environment without forking the platform.

---

## Long-term vision

Design as if OpenRabbit may eventually coordinate:

- dozens of AI workers per organization
- hundreds of connected tools
- thousands of workflows
- millions of users across many industries

Do not prematurely optimize every path—but refuse architecture that forces a rewrite to get there.

Over time OpenRabbit becomes:

1. A **control plane** for identity, orgs, permissions, workers, workflows, memory, tools, events, audit, and the evolving operational user/org model
2. A **runtime plane** where OpenClaw and future engines execute tasks behind a stable interface
3. A **capability plane** of installable business modules
4. A marketplace of **industry packs** that extend core without forking it
5. An **adaptive composition layer** that determines which capabilities, workers, workflows, and information should be active or visible for a given user and context
6. Frontend-agnostic **customer experience** apps (web, mobile, CEO dashboard, portals)

---

## Target user

**Primary:** Business owner / founder / CEO who wants AI staff and an environment that organizes itself around their work, not chat toys.

**Secondary:** Operators and managers who supervise workers, approvals, and reports.

**First market for implementation and testing:** Real estate (acquisitions, underwriting, research, CRM-connected ops).

**Non-goal for core:** Building only a real-estate SaaS. Real estate is pack #1, not the identity of the platform.

---

## Product promise

| Promise | Meaning |
|---|---|
| Adaptive by default | OpenRabbit learns context and assembles a useful environment instead of demanding configuration first |
| Evolves with the user | The environment can change as goals, roles, teams, tools, and businesses change |
| Hire AI workers, not prompts | Roles are configurable employees with scope and permissions |
| Runtime choice without rewrite | OpenClaw today; other runtimes later via adapters |
| Industry without forks | Packs extend core; verticals do not clone the monorepo |
| Orchestrate first | Connect existing services before rebuilding them |
| Native when valuable | Users may migrate data into OpenRabbit-native capabilities when consolidation is useful |
| CEO remains in control | Consequential actions require policy and human approval |
| Auditability | Important actions leave a durable trail |
| No frontend lock-in | Platform APIs outlive any particular UI generator |
| Progressive disclosure | Users see the capabilities relevant to their current context rather than the full platform at once |

---

## Non-negotiable separations

These concepts must stay separate in code, docs, APIs, and product language:

1. **OpenRabbit** — product, platform, adaptive AI operating environment  
2. **Runtime** — execution engine (OpenClaw is one)  
3. **AI Worker** — configurable specialized role  
4. **Tool** — callable capability  
5. **Workflow** — portable ordered business process  
6. **Integration** — external system connection  
7. **Industry Pack** — reusable industry bundle  

See also: `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md`.

---

## Success criteria

OpenRabbit is on-vision when:

1. A new runtime can be added by implementing the runtime adapter contract only.
2. A new worker role can ship largely as configuration/manifest, not a platform fork.
3. A capability can be enabled/disabled per organization.
4. OpenClaw can be removed without collapsing Platform APIs.
5. Frontends can be replaced without backend redesign.
6. Real-estate workflows keep working while the architecture migrates.
7. GitHub docs remain the source of truth for humans and AI tools.
8. A new user can describe their work and connect/import existing systems without manually designing the platform architecture.
9. OpenRabbit can construct a sensible initial environment from that context and explain what it configured and why.
10. The environment can evolve without destroying user control, permissions, auditability, or existing working systems.
11. Users can answer **what matters today, what OpenRabbit handled, what needs approval, and what happens next** without navigating the full capability surface.

---

## Working product language

**OpenRabbit is adaptive software that creates an evolving operating environment around each user.**

Supporting expression:

> **It learns you. It builds around you. It works with you. It evolves with you.**

This language describes the product direction, not permission to impersonate a user or bypass explicit authorization boundaries.

---

## Related documents

- `docs/ARCHITECTURE.md` — layered system and entities  
- `docs/PRINCIPLES.md` — permanent engineering/product rules  
- `docs/RUNTIMES.md` — runtime adapter model  
- `docs/AI_WORKERS.md` — worker model  
- `docs/INDUSTRY_PACKS.md` — pack model + real estate example  
- `docs/ROADMAP.md` — incremental migration plan  
- `OPENRABBIT_CONTEXT.md` — mandatory read for all AI tools  
