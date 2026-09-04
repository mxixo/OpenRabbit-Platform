# Living Agenda Meeting Companion

## Purpose

The Meeting Companion extends Living Agenda into authorized meetings so the execution coach can help the user stay oriented, retrieve relevant context, capture decisions, and convert meeting outcomes into an updated agenda without requiring the user to manually reconstruct what happened afterward.

The goal is not to create a surveillance bot or silently record other people. The goal is to provide an explicit, consent-aware meeting assistant for the user and, where permitted, other participants.

## Core experience

When a calendar event contains a supported meeting link, Living Agenda may offer to join or attach to the meeting using a provider-supported integration.

During the meeting, where platform capabilities and permissions allow, the companion may:

- listen to or consume an authorized transcript/media stream
- identify decisions, commitments, follow-ups, deliverables, deadlines, blockers, and unresolved questions
- retrieve referenced documents, PDFs, emails, calendar events, or other authorized sources
- present relevant previews to the user without forcing them to leave the meeting
- maintain private user notes and meeting context
- answer questions such as "what did they just ask me for?" or "pull up the PDF they're referring to"
- mark uncertain interpretations for review rather than silently turning them into commitments

After the meeting, it may:

- create a concise summary
- extract action items and owners
- preserve deadlines and dependencies
- propose new or revised Living Agenda plan items
- reconcile the rest of the user's day or week
- draft follow-up communications where authorized
- link meeting-derived tasks back to the meeting source for traceability

## Meeting intelligence loop

Meeting Source -> Authorized Media/Transcript -> Meeting Signals -> Context Retrieval -> Decisions/Actions -> User Review/Policy -> Living Agenda Reconciliation

## Real-time context retrieval

One of the highest-value behaviors is contextual retrieval while the meeting is happening.

Examples:

Participant: "In the appraisal PDF, page 14 has the comparable sales."

Living Agenda may search authorized files, identify the likely appraisal, and surface a preview or link to page 14.

Participant: "I sent you the revised numbers in the email from Friday."

Living Agenda may search authorized email for the relevant thread and present a preview or candidate result.

Participant: "Can you have this to me by Thursday?"

Living Agenda may recognize a candidate commitment and display:

> Possible action item: deliver revised analysis by Thursday. Confirm?

The system should prefer assistive retrieval and proposed actions over silently making consequential commitments on the user's behalf.

## Source hierarchy and confidence

Meeting-derived information should preserve provenance.

Possible sources include:

- live authorized transcript/media
- provider-generated transcript
- user notes
- participant chat
- calendar metadata
- retrieved file/email/document
- AI inference

A direct statement in a reliable transcript and an AI-inferred implication are not equivalent evidence.

## Meeting signals

The Personal Signal Layer should eventually support meeting-related signals such as:

### MeetingStarted
Meeting session became active.

### MeetingTranscriptSegment
Authorized transcript/media produced a segment with timestamp and speaker attribution where available.

### MeetingDecision
A decision was explicitly made or strongly confirmed.

### MeetingActionCandidate
Potential follow-up, deliverable, owner, or deadline extracted from the meeting.

### MeetingCommitmentConfirmed
User or authorized participant confirmed a candidate commitment.

### MeetingBlocker
Dependency or obstacle surfaced.

### MeetingReferenceMentioned
A file, email, document, person, project, or other source was referenced.

### MeetingContextRetrieved
An authorized retrieval result was surfaced to the user.

### MeetingEnded
Meeting finished and post-meeting reconciliation may begin.

## Consent and privacy

Meeting assistance must be explicit and compliant with the meeting provider, organizational policy, applicable law, and user/participant consent requirements.

Living Agenda should never attempt to hide its participation or recording/transcription behavior.

Requirements include:

- use provider-supported joining/media/transcript mechanisms
- respect platform recording/transcription indicators
- do not bypass meeting controls
- clearly indicate when the companion is active
- support organization policy and administrator restrictions
- minimize retention of raw meeting media when summaries/signals are sufficient
- separate private personal notes from organization-shareable meeting artifacts
- preserve access controls from source documents/emails

The fact that a user can access a document does not automatically mean every meeting participant should be shown that document.

## Private companion vs shared meeting artifact

Living Agenda should distinguish two scopes.

### Private companion scope

Visible only to the user unless deliberately shared:

- private notes
- personal reminders
- suggested talking points
- private retrieved email previews
- personal agenda implications
- execution-coach observations

### Shared meeting scope

Potentially shareable according to permissions and user choice:

- agreed action items
- approved meeting summary
- confirmed decisions
- shared documents already accessible to participants

Personal behavioral intelligence must not leak into shared meeting artifacts.

## Retrieval policy

Real-time retrieval should follow least privilege and relevance.

The system should search only sources the user has authorized and only when retrieval supports the current meeting context.

For ambiguous references, present likely matches rather than pretending certainty.

Example:

> I found two files that may be the appraisal they're referring to. The newer one was modified yesterday. Preview it?

## Attention design

The Meeting Companion should not flood the user with overlays.

Prioritize:

- direct questions requiring user response
- deadlines/commitments
- requested source retrieval
- contradictions or important missing information
- high-value facts relevant to a current discussion

Defer lower-priority observations until the post-meeting summary.

## Agenda integration

After the meeting, confirmed outputs should become normalized Living Agenda inputs.

Examples:

- deadline -> plan item / priority factor
- blocker -> dependency signal
- follow-up -> task candidate
- newly scheduled meeting -> calendar commitment
- delegated work -> owner/dependency update
- changed project priority -> goal/priority update

The meeting should therefore update the Living Agenda rather than create a disconnected note repository.

## Provider-neutral architecture

The core Meeting Companion should not depend on Zoom, Google Meet, Microsoft Teams, or a single transcription vendor.

Provider adapters may expose capabilities such as:

- join/attach
- live media access
- live transcript access
- post-meeting transcript retrieval
- participant metadata
- chat retrieval
- meeting lifecycle events

The core should operate on normalized meeting signals.

## Current feasibility notes (August 2026)

This concept is partially buildable with current provider APIs, but capability varies by platform and tenant/account policy.

Google Meet's Media API currently provides real-time audio/video/participant access for enrolled Developer Preview participants and explicitly lists real-time insights and action-item documentation as use cases. For production-grade implementations outside preview constraints, post-meeting REST/transcript workflows may be more practical until broader availability.

Microsoft Graph supports retrieving Teams meeting transcripts and receiving change notifications when transcripts/recordings become available, subject to meeting type, tenant administrator controls, permissions, and application access policy.

Authorized file retrieval is already practical through systems such as Google Drive search/get APIs, and equivalent email/document adapters can be used to surface referenced context.

## Phased delivery

### Phase 1: Post-meeting intelligence

- ingest provider transcript after meeting
- summarize
- extract action candidates/deadlines/decisions
- require confirmation for ambiguous commitments
- feed confirmed items into Living Agenda reconciliation

### Phase 2: Live transcript companion

- consume supported live transcript/media
- detect action candidates and reference mentions
- show private meeting-side suggestions
- retrieve authorized files/emails on request or high-confidence reference

### Phase 3: Proactive real-time assistant

- contextual fact/document retrieval
- private talking-point suggestions
- real-time contradiction/dependency alerts
- richer watch/phone companion surfaces

### Phase 4: Organization meeting operations

Within OpenRabbit Business, approved meeting signals may feed organization projects, departments, workers, approvals, and CEO attention queues while preserving personal/private scope boundaries.

## Product principle

The user should leave a meeting with less cognitive cleanup than they entered with.

A successful Meeting Companion means the user does not need to remember every promise, search through email for every referenced document, or manually rebuild the agenda afterward. Living Agenda quietly converts the meeting into organized, reviewable next steps while preserving consent, privacy, and user authority.
