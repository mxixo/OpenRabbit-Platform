# Private Network & Security Architecture

## Purpose

OpenRabbit treats private networking, least privilege, user control, and auditability as architectural requirements. The objective is to connect user-owned resources without unnecessarily exposing them to the public Internet or granting broader permissions than a task requires.

## Layer responsibilities

### OpenRabbit — orchestration and policy
OpenRabbit is the product intelligence and orchestration layer. It owns user-facing identity context, policy, approvals, work state, coordination, and auditability.

### OpenClaw — execution/runtime
OpenClaw is an execution/runtime provider behind OpenRabbit. It exposes bounded capabilities through approved nodes. Product clients must not receive unrestricted shell access or gateway credentials.

### Tailscale — private network fabric
Tailscale provides encrypted private connectivity between authorized infrastructure and trusted nodes. It is transport and network access control, not the OpenRabbit application permission system and not the orchestration brain.

Tailnet membership alone MUST NOT imply permission to execute arbitrary commands, read arbitrary files, retrieve credentials, or invoke every capability on a node.

### Host and cloud security
Host/cloud firewalls, OS hardening, endpoint security, application authentication/authorization, secret management, and monitoring remain independent defense layers. Tailscale must not be treated as a replacement for them.

## Reference topology

```text
User
  |
  v
OpenRabbit
(orchestration / policy / approvals / audit)
  |
  v
OpenClaw
(execution / runtime provider)
  |
  v
Tailscale private network fabric
  |
  +---- VPS ----- firewall + OS hardening
  |
  +---- Mac ----- endpoint security + scoped capabilities
  |
  +---- iPhone -- iOS permissions + scoped mobile capabilities
```

The VPS is the stable always-on runtime/coordinator. The Mac is a trusted desktop execution surface. The iPhone is a trusted mobile/context surface. These roles describe capability profiles, not blanket trust levels.

## Security principles

1. **Private by default.** Administrative and node-management services should not be publicly exposed when private tailnet reachability is sufficient.
2. **Least privilege.** Nodes receive only the capabilities required for their roles. Network reachability and execution authorization are separate decisions.
3. **Defense in depth.** Combine encrypted private networking with firewalls, OS security, application authorization, scoped credentials, MFA/passkeys where appropriate, endpoint protections, and durable audit logs.
4. **Customer isolation.** Future multi-user/multi-tenant deployments must prevent compromise of one customer's node, credentials, or environment from providing a path to another customer's resources.
5. **Explicit enrollment and revocation.** Trusted nodes require controlled enrollment, strong device identity, rotating/revocable credentials, capability approval, and auditable revocation.
6. **No infrastructure secrets in clients.** Mobile/web clients must not receive gateway tokens, tailnet/private-network credentials, infrastructure secrets, or unrestricted execution credentials.
7. **User control and transparency.** Sensitive actions should be attributable, permissioned, reviewable, and visible through OpenRabbit approval/audit surfaces.
8. **Assume partial compromise.** Design boundaries so compromise of one node or application layer does not automatically compromise the rest of the system.

## Exit nodes

An exit node is optional routing infrastructure. It is not required for OpenClaw to communicate with another trusted node; private device-to-device communication comes from the tailnet itself.

An approved exit node additionally allows selected authorized traffic to reach the public Internet through that node. OpenRabbit may eventually use exit nodes for:

- controlled alternate egress during diagnostics;
- mobile/cellular network testing;
- reproducing network-dependent failures;
- resilience experiments; and
- explicitly approved privacy/network-routing workflows.

OpenRabbit should not depend on a user's iPhone as its permanent production Internet gateway. The always-on VPS remains the stable production backbone unless the architecture is deliberately changed.

## Trust boundary model

The intended security chain is:

```text
identity
  -> authorization
  -> encrypted private networking
  -> node capability controls
  -> application permissions
  -> action approval where required
  -> audit + revocation
```

No single layer should be treated as sufficient by itself.

## Product implication

Privacy is not merely a marketing property. OpenRabbit should make it an implementation property: connect user resources while minimizing exposure, credential distribution, and unnecessary access.

As OpenRabbit evolves from the current single-user prototype toward a public product, this architecture should drive node enrollment, organization isolation, capability contracts, secret handling, infrastructure exposure, audit design, and security testing.

## Follow-up engineering work

- Inventory every currently public VPS port/service and classify whether it can move behind private networking.
- Define organization-scoped node enrollment and revocation.
- Formalize capability-level authorization independently from tailnet connectivity.
- Define firewall baseline for production VPS deployments.
- Add threat-model tests for compromised node, stolen credential, compromised web client, and cross-tenant access attempts.
- Evaluate stronger device admission controls, including cryptographic node authorization, before public beta.
- Document exit-node usage as an optional diagnostic/routing capability rather than a dependency.