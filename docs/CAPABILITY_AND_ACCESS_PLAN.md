# OpenRabbit Capability, Access, and Hardening Plan

Last reviewed: 2026-09-04

## Purpose

This document converts successful operator tests into a runtime-neutral OpenRabbit capability plan. It distinguishes tools available to a founder/operator through Codex from connectors that are safe and complete for every OpenRabbit customer.

## Non-negotiable connection model

1. Every private provider connection belongs to one authenticated OpenRabbit user and organization.
2. A customer sees **Ready to connect** until that customer completes the provider's OAuth flow and OpenRabbit verifies the provider account.
3. Provider client secrets belong to OpenRabbit infrastructure. User access and refresh tokens belong in an encrypted server-side vault and are never shipped to a client.
4. Connection lookup is keyed by `orgId`, `userId`, `provider`, and `connectionId`; never by provider alone or a shared installation identity.
5. Requested OAuth scopes are explicit and least-privilege. Expanded write/send/publish scopes require reconnection and a visible explanation.
6. Revocation, expiration, account mismatch, and failed health checks immediately return the connection to **Ready to connect**.
7. After one-time connection consent, authorized reads and ordinary writes run without repeated prompts under the default **Seamless** profile. Optional stricter profiles can require review for selected actions.
8. Every consequential attempt records actor, tenant, connection, action, policy decision, approval, runtime, result, and verification evidence.

## Ultimate-experience autonomy loop

The normal interaction is **intent once → plan silently → execute continuously → verify → report the result**. OpenRabbit should bundle related actions into one plan, reuse durable account consent, recover from routine failures automatically, and avoid asking the user to supervise tool-by-tool execution.

Interrupt the user only when OpenRabbit needs information it cannot safely infer, a provider legally requires a personal act, a requested outcome materially changes, or every authorized recovery path has failed. Progress, policy decisions, retries, and receipts remain available in an activity trail without becoming conversational clutter.

Optional modes let a user choose more review:

- **Seamless (default):** execute within connected-account scopes and report outcomes.
- **Review important actions:** pause only for categories selected by the user.
- **Strict:** review external changes before execution.

## Capability inventory

| Capability | Validated operator path | OpenRabbit production state | Direct path needed |
| --- | --- | --- | --- |
| Repository and deployments | GitHub workspace and Hostinger operations | Emerging | GitHub App/OIDC deployment identity, protected environments, rollback verification |
| VPS and private nodes | Hostinger VPS plus trusted Mac/Tailscale pattern | Emerging | Durable node registry, health, capability routing, scoped node credentials |
| CRM | HubSpot read/write access is available to the operator | Emerging | Per-user OAuth records, write scopes, webhook sync, tenant-isolation tests |
| Email and calendar | Google Drive is connected; browser paths have been tested | Partial | Gmail/Calendar OAuth, send/event scopes, webhook subscriptions, autonomy policy |
| Microsoft mail/calendar | Architecture direction recorded | Planned/partial | Microsoft Entra app and Graph delegated scopes |
| Social | Meta, LinkedIn, and TikTok browser/OAuth work has been tested | Provider-review dependent | Approved production apps, per-user OAuth, publish APIs, webhook verification |
| Real-estate workflows | Local OpenClaw skill suite exists and has been exercised | Prototype | Move skill logic behind capability and workflow contracts; add fixtures and policy tests |
| MLS/listings | FlexMLS browser operation has been exercised | Browser-only | MLS/vendor authorization and RESO Web API feed/write agreement |
| Contracts/deals | Jointly browser operation has been exercised | Browser-only | Jointly partner/API access or documented export/webhook bridge |
| Transaction management | HomeSmart portal browser operation has been exercised | Browser-only | Brokerage-approved API, secure intake mailbox, or verified document handoff adapter |
| Documents/e-sign | Document and e-sign workflows exist as skills | Prototype | Production e-sign provider OAuth/service integration and immutable packet audit |
| Knowledge/project OS | Notion connection supports reads and writes | Operator-ready | Decide whether Notion remains internal documentation only or becomes a tenant connector |
| Data/auth | Supabase plugin access is available | Emerging | Production RLS review, service-role isolation, migration discipline, backup/restore tests |
| Browser/desktop execution | Chrome and local computer control are available | Operator-only | Trusted-node agent, domain allow-list, session isolation, screenshot/download redaction |
| Images/content | Image generation and Canva tooling are available | Operator-ready | Brand kit, asset provenance, listing-photo rights, compliance approval pipeline |

“Operator-ready” does not mean “customer-connected.” Personal Codex connections must never be used as OpenRabbit customer credentials.

## OpenClaw integration strategy

OpenClaw remains a runtime adapter. The real-estate logic is represented in `capabilities/real-estate/manifest.json`, then executed through OpenRabbit's worker, workflow, permission, integration, and audit contracts.

Migration sequence:

1. Register the real-estate capability manifest in the platform catalog.
2. Convert each local OpenClaw skill into a versioned tool handler and workflow template with fixtures.
3. Implement the OpenClaw `RuntimeProvider` adapter for session lifecycle, task execution, tool projection, cancellation, and event translation.
4. Route requests through `WorkerOrchestrator`; remove direct product-edge skill dispatch except for a deprecated compatibility shim.
5. Resolve the tenant's autonomy profile before projecting or invoking a tool; missing per-action overrides use the seamless profile.
6. Verify provider-side completion and store the receipt in the audit stream.
7. Run the same contract suite against OpenClaw and any future runtime/model provider.

## Access-friction register

| Obstacle/workaround | Why it happens | Direct access that removes it | Owner action |
| --- | --- | --- | --- |
| Browser automation for MLS | No approved programmatic listing endpoint | MLS/RESO vendor credentials with permitted read/write operations | Ask the MLS association/vendor for RESO Web API and listing-input eligibility |
| Browser automation for Jointly | No public production API is confirmed | Partner API, OAuth app, webhooks, or approved export integration | Contact Jointly partnerships/support with the OpenRabbit integration brief |
| Browser automation for brokerage portal | Portal is designed for a person, not an integration | Brokerage-approved transaction API or secure document intake | Ask HomeSmart technology/compliance for supported integration routes |
| Social login works but publishing is restricted | Provider app review and business-account requirements | Approved Meta/LinkedIn/TikTok production permissions | Complete business verification, privacy/data-deletion URLs, screencasts, and review submissions |
| Repeated local browser login | Browser sessions are local and fragile | Provider OAuth through the hosted connection gateway | Finish production callback domains and per-user token storage |
| Limited observability during failures | Logs are local/inconsistent | OpenTelemetry plus an error/trace backend | Select Sentry or an OpenTelemetry-compatible backend and provision a project |
| Optional review requests across channels | Some users may choose a stricter autonomy profile | Mobile/Slack review channel bound to signed action payloads | Add only as an optional profile; web/mobile remains the fallback |
| Manual GitHub/VPS secrets | Long-lived secrets create operational risk | GitHub environments plus OIDC/short-lived deployment credentials where supported | Protect production environment and require deployment approval/health checks |

## Recommended connection order

### Now: unlock reliable testing

1. GitHub repository/app access and protected production environment.
2. Error monitoring and tracing (Sentry or OpenTelemetry backend).
3. Google Workspace OAuth for Gmail, Calendar, and Drive; Microsoft 365 if it is a target launch provider.
4. HubSpot webhooks and org-scoped write verification.
5. Meta production review, then LinkedIn and TikTok production review.
6. MLS/RESO access request and Jointly partnership request in parallel because vendor approval can be slow.

### Next: complete the operating loop

1. E-sign provider.
2. SMS/voice provider with consent and opt-out enforcement.
3. Stripe for subscriptions, usage metering, and credit ledger—not as the source of authorization.
4. Product analytics with tenant-safe event design.
5. A work tracker (choose one of Notion, Linear, Asana, ClickUp, or Trello) as the authoritative delivery queue.

## Permission posture observed in the operator environment

As of 2026-09-04, HubSpot, Notion, Google Drive, and Supabase have app-specific **Allow all actions** permission. Hostinger inherits the global **Allow low-risk actions** setting. These settings make operator work faster, but they are ChatGPT workspace permissions—not OpenRabbit customer authorization—and must not be copied into product policy.

The default product posture is seamless autonomy after one-time account consent:

- automatic by default: health checks, search/read, analysis, drafting, sending, publishing, CRM/calendar updates, document transfer, listing work, and transaction coordination within connected-account scopes;
- one-time consent: connect the provider with the useful read/write/send scopes, then retain and refresh that connection securely;
- optional controls: users can select review-important-actions or strict profiles if they prefer more prompts;
- confirmation remains provider- or law-required only where the external system cannot delegate the act, such as a personal legal signature.

## Hardening work started in this review

- Workflow policy checks now honor explicit denials while preserving seamless execution when no stricter per-step decision is configured.
- The real-estate capability manifest records the validated OpenClaw workflow suite without making OpenClaw the product boundary.
- Worker execution and session lifecycle now require a trusted organization/subject context, keep sessions tenant-bound, reject runtime identity mismatches, and recreate sessions when projected authority changes.
- Memory and knowledge records now include organization scope in their storage keys and APIs, bind service namespaces to trusted execution context, reject unscoped persisted records, serialize development-store writes, and return defensive copies so one request cannot mutate shared tenant state.
- These controls are service-side and do not introduce user prompts; the seamless autonomy loop remains the default experience.
- The next implementation gates are tenant-bound integration handles, durable tamper-evident audit/state storage, webhook authenticity/replay protection, and runtime adapter contract tests.

## Definition of ready for broad beta

- Two separate test users cannot see, invoke, refresh, or revoke each other's connections or data.
- Every connector has connect, verify, refresh, revoke, reconnect, and account-mismatch tests.
- Every external write has autonomy-policy, idempotency, execution, verification, and audit tests.
- OpenClaw can run the runtime conformance suite using only projected tools and org-scoped memory.
- A failed provider call can be retried safely without duplicate sends, posts, records, or listings.
- Production has centralized traces, error alerts, connector health, queue depth, cost/usage, and action outcome metrics.
- Backup restore, VPS restart, trusted-node reconnect, token expiry, webhook replay, and provider outage drills pass.
