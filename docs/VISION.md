# OpenRabbit Vision

**Status:** Canonical product vision  
**Audience:** Humans and AI contributors (Warp, OpenClaw, Antigravity, ChatGPT, and others)  
**Source of truth:** This file and the companion docs linked from `OPENRABBIT_CONTEXT.md`

---

## What OpenRabbit is

OpenRabbit is an **AI Operating Environment**.

It is a modular platform where:

- one or more **AI runtimes** can operate
- specialized **AI workers** coordinate work for a business
- **tools, workflows, APIs, MCP servers, databases, and external apps** are composed safely
- the system adapts to the **goals and industry** of the end user

OpenRabbit is **not**:

- a chatbot
- a single AI agent
- “an OpenClaw product”
- a thin UI wrapper around one model vendor
- a fork-per-industry codebase

Customers purchase **OpenRabbit the platform**. OpenClaw is currently one supported **runtime** inside that platform. The environment must remain **runtime-agnostic**.

---

## The problem

Business owners do not need another chat window.

They need something closer to an operating system for work:

- turn a mission into departments, roles, and goals
- assign specialized workers with clear permissions
- connect existing tools instead of rebuilding them
- run repeatable workflows with approvals and audit trails
- get metrics, reports, and recommendations they can act on
- stay in control of consequential decisions

Today’s agent demos collapse when:

- one mega-prompt tries to do every job
- tools and credentials are unbounded
- industry logic is hardcoded into the runtime
- the product cannot swap models, runtimes, or frontends without a rewrite

---

## Mission

Help owners and CEOs run their organizations alongside configurable AI workers—safely, modularly, and in a way that compounds across industries.

OpenRabbit should help transform a user’s mission into:

- organized departments and worker roles
- goals and priorities
- workflows and playbooks
- metrics and reports
- recommendations
- **approved** actions

The end user is treated as the **owner / CEO**. OpenRabbit is the operating environment; workers are the specialized staff.

---

## Long-term vision

Design as if OpenRabbit may eventually coordinate:

- dozens of AI workers per organization
- hundreds of connected tools
- thousands of workflows
- millions of users across many industries

Do not prematurely optimize every path—but refuse architecture that forces a rewrite to get there.

Over time OpenRabbit becomes:

1. A **control plane** for identity, orgs, permissions, workers, workflows, memory, tools, events, and audit
2. A **runtime plane** where OpenClaw and future engines execute tasks behind a stable interface
3. A **capability plane** of installable business modules
4. A marketplace of **industry packs** that extend core without forking it
5. Frontend-agnostic **customer experience** apps (web, mobile, CEO dashboard, portals)

---

## Target user

**Primary:** Business owner / founder / CEO who wants AI staff, not chat toys.

**Secondary:** Operators and managers who supervise workers, approvals, and reports.

**First market for implementation and testing:** Real estate (acquisitions, underwriting, research, CRM-connected ops).

**Non-goal for core:** Building only a real-estate SaaS. Real estate is pack #1, not the identity of the platform.

---

## Product promise

| Promise | Meaning |
|---|---|
| Hire AI workers, not prompts | Roles are configurable employees with scope and permissions |
| Runtime choice without rewrite | OpenClaw today; other runtimes later via adapters |
| Industry without forks | Packs extend core; verticals do not clone the monorepo |
| Orchestrate first | Connect existing services before rebuilding them |
| CEO remains in control | Consequential actions require policy and human approval |
| Auditability | Important actions leave a durable trail |
| No frontend lock-in | Platform APIs outlive any particular UI generator |

---

## Non-negotiable separations

These concepts must stay separate in code, docs, APIs, and product language:

1. **OpenRabbit** — product, platform, AI operating environment  
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

---

## Related documents

- `docs/ARCHITECTURE.md` — layered system and entities  
- `docs/PRINCIPLES.md` — permanent engineering/product rules  
- `docs/RUNTIMES.md` — runtime adapter model  
- `docs/AI_WORKERS.md` — worker model  
- `docs/INDUSTRY_PACKS.md` — pack model + real estate example  
- `docs/ROADMAP.md` — incremental migration plan  
- `OPENRABBIT_CONTEXT.md` — mandatory read for all AI tools  
