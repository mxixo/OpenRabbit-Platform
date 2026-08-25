# Mobile Command Center and Trusted Node Architecture

**Status:** Validated prototype; productization required  
**Last reviewed:** 2026-08-25  
**Related:** `docs/ARCHITECTURE.md`, `docs/RUNTIMES.md`, `docs/AI_WORKERS.md`, `docs/ROADMAP.md`

---

## 1. Purpose

OpenRabbit should let an operator stay connected to the business from a phone while trusted computers perform private or machine-local work. The mobile app is the **CEO command and approval surface**. It is not a remote desktop and it does not connect directly to OpenClaw.

OpenClaw remains a runtime implementation behind OpenRabbit's stable platform contracts. Trusted customer devices are execution surfaces registered with the OpenRabbit control plane and exposed only through explicit capabilities, policy, and audit.

## 2. Target topology

```text
Mobile app / Web dashboard
          │
          │ versioned OpenRabbit Platform API + events
          ▼
OpenRabbit Core control plane
Identity · Orgs · Workers · Work · Approvals · Audit · Node registry
          │
          ├── RuntimeProvider ── OpenClaw adapter ── cloud tools/integrations
          │
          └── Node gateway ── private encrypted network ── trusted customer node
                                                    Files · local apps · local models
```

The control plane owns identity, tenancy, policy, approvals, work state, and audit. Runtime and node adapters translate those decisions into execution. Apps receive safe product data and events, never raw infrastructure credentials.

## 3. Validated reference prototype

On 2026-08-25, the reference deployment proved the following loop without exposing the node publicly:

- A Hostinger-hosted OpenClaw gateway and a macOS node authenticated on the same private Tailscale network.
- The gateway reached the Mac over the encrypted tailnet and the Mac reached the gateway through a tailnet-only TLS endpoint.
- The Mac enrolled as a named node and declared a bounded capability set.
- A harmless cloud-to-Mac command resolved approved local executables successfully.
- The node was installed as a macOS LaunchAgent and remained connected after the temporary foreground process stopped.

This validates transport, enrollment, capability approval, remote execution, and persistent reconnection as a prototype. It does **not** yet constitute the production OpenRabbit device product.

## 4. Product responsibilities

### Mobile command center

The first mobile experience should contain five surfaces:

1. **Today** — prioritized alerts, deadlines, and exceptions.
2. **Workers** — worker health, current assignments, and recent results.
3. **Work** — task status, reports, and deal activity.
4. **Approvals** — consequential actions awaiting a human decision.
5. **Command** — natural-language or structured instructions routed through Core.

Push notifications should deep-link to a specific approval, exception, report, or task. The phone sends intent to OpenRabbit Core; it never sends arbitrary shell commands directly to a customer device.

### Trusted nodes

A node provides private execution near the customer's data and applications. Each node has:

- an organization-scoped device identity;
- a human-readable name and owner;
- declared and approved capabilities;
- online, offline, degraded, and revoked states;
- version, health, and last-seen metadata;
- policy-bound access to files, applications, browsers, or local models;
- complete task and command audit history.

## 5. Enrollment and reconnect lifecycle

```text
Install desktop agent
  → sign in to organization
  → create one-time enrollment request
  → show requested capabilities
  → authorized user approves from web/mobile
  → issue revocable device credential
  → establish private connection
  → publish health/capabilities
  → reconnect automatically after login or network recovery
```

The production flow must replace copied gateway tokens with short-lived enrollment grants and revocable, rotated device credentials. A device that is asleep or offline should queue eligible work or return a clear unavailable state rather than silently failing.

## 6. Security and progressive autonomy

- Core authorizes every task against organization, worker, user, node, and capability policy.
- Workers receive projected, allow-listed tools; node registration does not imply access to every device capability.
- Reading, drafting, analyzing, and preparing may run automatically when policy allows.
- Sending communications, modifying systems of record, publishing, spending money, signing, or deleting requires the configured approval gate.
- Secrets remain server-side or in an approved device secret store and are referenced by identifier.
- Every request records initiator, worker, node, capability, approval, inputs, outcome, and timestamps.
- Revocation must immediately prevent new work and terminate renewable credentials.

## 7. First real-estate reference loop

```text
New opportunity alert
  → Research worker gathers cloud-accessible context
  → trusted node reads approved local deal files or invokes a local model
  → Acquisitions worker produces analysis and recommendation
  → mobile push requests approval
  → operator approves, rejects, or revises from phone
  → CRM is updated through an IntegrationAdapter
  → result and audit trail appear in the command center
```

This loop demonstrates the product promise: the operator stays mobile, the platform stays in control, workers do the coordination, and private customer resources remain on the trusted node.

## 8. Production gaps

Before customer release, implement:

- a Core-owned node registry and organization-scoped enrollment API;
- device credential issuance, rotation, revocation, and recovery;
- stable node capability contracts and policy projections;
- versioned mobile APIs, event delivery, push notifications, and deep links;
- signed desktop packaging, background updates, and cross-platform lifecycle support;
- offline queues, wake-state visibility, timeouts, retries, and idempotency;
- durable audit records and administrator controls;
- end-to-end tests for enrollment, reconnect, approval, revocation, and failure recovery.

The current Tailscale/OpenClaw deployment is a strong reference adapter and development environment. Product clients must depend on OpenRabbit contracts so the underlying network or runtime can evolve without rewriting the mobile experience.
