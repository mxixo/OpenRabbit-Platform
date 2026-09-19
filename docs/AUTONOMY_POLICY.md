# OpenRabbit Autonomy Policy

## Product principle
**Maximum useful autonomy within explicit boundaries. Minimum unnecessary interruption. Complete observability.**

OpenRabbit is designed to execute continuously inside the user's explicitly connected OpenRabbit environment. Security controls should be invisible during normal authorized work and should not create confirmation fatigue.

## Boundary
The agent may use capabilities and data explicitly connected to the authenticated OpenRabbit environment. It may not grant itself new permissions, bypass the policy engine, expose credentials, disable auditing, or escape the execution boundary.

## Decision classes
### GREEN — execute automatically
Routine actions inside durable user-granted capability scopes. Record the action and provider receipt without interrupting the user.

### YELLOW — execute and surface
Authorized but unusual actions, including abnormal batch size, unusual recipient/destination, or materially atypical workflow behavior. Execute when policy permits; elevate visibility in the activity stream.

### RED — require confirmation
Use sparingly. Required for newly requested permissions, credential/security changes, destructive bulk actions, material financial commitments, or actions outside existing delegated authority.

### BLOCK — deny
Attempts to exceed tenant/user authority, expose secrets, disable or evade policy/audit controls, cross the OpenRabbit boundary, or perform explicitly prohibited operations.

## Autonomy profiles
- **Seamless (default):** GREEN automatic; YELLOW automatic + visible; RED confirmation.
- **Review important actions:** GREEN automatic; YELLOW/RED may require review based on capability policy.
- **Strict:** broader confirmation requirements.
Hard tenant-isolation, credential, audit, and boundary controls are not user-disableable.

## Policy evaluation
Every external action carries: user/org, capability, connection ID, requested operation, resource scope, risk class, policy decision, timestamps, runtime/model identity, execution result, verification receipt, and provenance.

## No self-policing
The worker model does not decide whether its own action is authorized. A separate deterministic policy service resolves standing permission and risk class before the connector executes.

## Provenance
Explanations of what data was used must come from execution/provenance records, not model recollection. The UI should support “Why does OpenRabbit know this?” with deterministic source receipts.

## Product metric
Track automatic actions, surfaced unusual actions, approval requests, denials, and policy errors. A healthy Seamless profile should minimize unnecessary approval prompts without increasing boundary violations.
