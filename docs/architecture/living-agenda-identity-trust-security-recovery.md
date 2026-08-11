# Living Agenda Identity, Trust, Security & Recovery

## Purpose

Living Agenda may contain highly personal behavioral, scheduling, wellness, goal, and reflection data. Security therefore cannot be reduced to a login screen. The product should continuously balance low-friction everyday use with stronger verification when consequence or uncertainty increases.

The desired model is:

Authenticate -> Evaluate Trust -> Authorize -> Execute -> Audit -> Recover

## Core principle

Security should become stronger as consequence and uncertainty increase rather than adding the same friction to every interaction.

Low-risk reversible actions should remain easy. Sensitive, consequential, unusual, externally visible, financial, destructive, or difficult-to-reverse actions should require stronger confidence or explicit re-authentication.

## Identity signals

No single signal should be treated as perfect proof of identity.

Potential trust signals include:

- device authentication/session state
- Face ID / Touch ID / device credential result
- trusted-device presence
- trusted watch/wearable presence
- voice recognition match
- recent successful re-authentication
- expected app/device context
- behavioral consistency
- organization role/session context where applicable

Behavior is useful primarily for anomaly detection, not conclusive authentication.

## Voice recognition

Voice recognition is an identity-confidence signal, not a standalone password.

A recognized voice can increase confidence for ordinary conversational actions. An unfamiliar or low-confidence voice can lower confidence and trigger stronger verification for consequential actions.

Voice recognition must not override device/biometric policy for high-risk operations.

The user should explicitly enroll or opt in to voice recognition and should be able to disable it and delete the enrolled voice profile.

The system should distinguish voice recognition from speech recognition:

- speech recognition: what was said
- voice recognition: who probably said it

These are separate capabilities and should remain separate in the architecture.

## Risk tiers

### Low risk

Examples:

- mark current task complete
- mark current task not complete
- add a reversible personal note
- ask what is next
- view current agenda on an already authenticated device

Default behavior: proceed with minimal friction while preserving undo/history.

### Moderate risk

Examples:

- reschedule several items
- substantially change today's availability
- alter a goal priority
- export a limited portion of personal data

Default behavior: explicit confirmation may be appropriate; low trust can trigger re-authentication.

### High risk

Examples:

- delete goals/history
- export sensitive behavioral or wellness data
- connect/disconnect sensitive integrations
- change privacy/security settings
- authorize consequential external actions
- make sweeping organization changes
- change roles/permissions

Default behavior: strong re-authentication and/or explicit approval required.

## Trust evaluation

A trust evaluation may consider:

- authenticated session strength
- recency of strong authentication
- voice-match confidence
- trusted companion-device presence
- action risk tier
- anomaly indicators
- unusual volume or velocity of changes
- conflicting identity signals

The exact scoring model should remain implementation-specific, but the decision outcome should be explainable enough to support debugging and recovery.

Potential outcomes:

- allow
- allow_reversible_only
- require_confirmation
- require_reauthentication
- block_and_alert

## Behavioral anomaly detection

Behavioral consistency can help detect unusual activity but should not punish legitimate changes in behavior.

Useful anomaly signals may include:

- unusually large numbers of edits/deletions
- rapid changes inconsistent with typical interaction cadence
- major changes from an unfamiliar voice
- sensitive actions from a new/untrusted device
- changes at unusual times combined with other uncertainty

Behavior alone should not permanently lock out the legitimate user.

## Companion-device security

A trusted watch or other companion device may serve as a secondary security surface.

Potential uses include:

- alerting the user about suspicious sensitive changes
- asking whether a major action was authorized
- offering a one-tap `Lock Living Agenda` action
- confirming a high-risk action where platform/security policy permits

Example:

Living Agenda Security Alert
Major agenda/security changes requested on iPhone.
Was this you?
[Yes] [Lock]

Companion confirmation should complement, not replace, platform authentication requirements.

## Panic lock

Living Agenda should support an immediate lock action such as:

"Lock Living Agenda."

A panic lock should:

- suspend active voice input
- hide sensitive content
- invalidate or suspend the active application session as appropriate
- require strong authentication to resume
- preserve unsaved safe state where possible

A paired trusted device may also expose a lock action where supported.

## Accidental-interference protection

The system should assume that legitimate devices can sometimes be used accidentally by someone else, including children or household members.

A short burst of unusual low-risk interactions should not automatically retrain the user's behavioral model.

Potential response:

"Several unusual changes were made between 4:12-4:19 PM. Review?"

Actions:

- keep changes
- restore prior state
- review individually

## Behavioral quarantine

Suspicious or user-disputed events may be quarantined from long-term learning until resolved.

Quarantined events may remain visible in audit/history but should not update pace, adherence, drift, or execution-maturity models until confirmed.

If an event is reversed or marked unauthorized, derived behavioral models should remove or neutralize its influence where practical.

## Recovery and version history

Prevention alone is insufficient. Living Agenda should preserve recoverable history for consequential state.

Every material change should capture:

- actor/source
- timestamp
- affected object
- prior state reference where practical
- resulting state
- trust/auth context
- action/approval reference

The user should eventually be able to perform actions such as:

- undo recent change
- restore agenda to a previous version
- restore goal configuration
- review suspicious session changes

Recovery must be designed alongside mutation APIs rather than added later.

## Organization security

For OpenRabbit Business and organization-scoped Living Agenda capabilities, the model expands to:

Identity -> Authentication -> Role -> Permission -> Action -> Approval -> Audit

Voice can identify a likely speaker but does not grant organization authority.

Permissions and approval policy determine whether the actor is allowed to execute the requested action.

Personal Living Agenda behavioral data must not become organization-visible merely because the same user belongs to an organization.

## Security/privacy boundary

Security telemetry should be purpose-limited. Identity confidence, voice profiles, device-trust signals, and anomaly data should not be repurposed into employee performance scoring or unrelated behavioral profiling.

The product should collect only what is necessary for authentication, authorization, abuse prevention, recovery, and explicitly authorized personalization.

## Fail-safe principles

1. Voice is not a standalone credential.
2. Behavior is not a standalone credential.
3. Consequence and uncertainty determine authentication strength.
4. Low-risk actions remain reversible.
5. Sensitive state changes are auditable.
6. Suspicious events can be excluded from behavioral learning.
7. Unauthorized changes can be recovered where practical.
8. Personal data remains private across organization boundaries by default.
9. Strong platform authentication should be preferred over homegrown biometric security.
10. Security controls should preserve the calm, natural product experience whenever risk is low.

## Near-term implementation implications

1. Add provider-neutral identity/trust decision contracts.
2. Add action-risk classification.
3. Add trust-context fields to execution/check-in events where appropriate.
4. Add correction/quarantine semantics for suspicious behavioral events.
5. Add recoverable state/version references for agenda mutations.
6. Keep Face ID/Touch ID/voice SDK implementations in application/platform adapters, not shared core.
