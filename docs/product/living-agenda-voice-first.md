# Living Agenda Voice-First Interaction Model

## Principle

Speech should be the primary interaction path for Living Agenda wherever the environment and user preference make it practical. Touch, typing, forms, buttons, and swipe gestures remain available as complementary and accessibility-aware alternatives rather than the assumed default.

The design goal is to minimize the distance between intention and execution:

Thought -> Speech -> Understanding -> Plan/Action -> Confirmation

A user should be able to establish goals, explain constraints, revise plans, report progress, ask what is next, and approve appropriate changes conversationally without navigating a form-heavy interface.

## First-run onboarding

Do not begin by forcing the user through a long questionnaire or a sequence of predefined lifestyle categories.

A preferred first-run experience is a guided AI conversation. One of the earliest onboarding questions should establish the user's preferred interaction mode and, where supported, offer foreground-ready voice interaction.

Example:

> Would you like Living Agenda to be ready for you to speak whenever the app is open? It will not listen when you leave the app, and you can change this anytime.

If the user opts in and grants the required operating-system microphone permission, the application may automatically enter a ready-to-speak state while it is visibly in the foreground rather than requiring a microphone-button press for every turn.

The execution coach can then begin with an open prompt such as:

> Tell me what you want your life to look like, what you are trying to accomplish, and what currently gets in the way. We can figure out the plan together.

The AI should progressively extract structured information from natural conversation, including when relevant:

- goals and desired outcomes
- deadlines and milestones
- recurring commitments
- work/school obligations
- health, fitness, rest, family, relationship, recreation, or learning priorities the user chooses to mention
- preferred working hours
- protected time and boundaries
- current frustrations
- perceived overwork or under-structure
- known routines
- accessibility preferences
- communication preferences
- desired coaching intensity

The user should not need to understand the underlying schema.

## Foreground-ready voice mode

Living Agenda may offer an explicit setting such as `Ready to Speak While App Is Open`.

When enabled:

- voice input becomes ready automatically when the app is visibly active in the foreground
- the user does not need to press a microphone button before every conversational turn
- leaving/backgrounding the app ends or suspends active listening
- returning to the foreground may restore the ready state according to the user's setting and platform permission state
- the interface must provide a persistent, unmistakable visual indication whenever the microphone is active or ready to capture speech
- the user must have an immediate mute/pause control
- the setting can be disabled at any time

This mode should be opt-in rather than silently enabled. Operating-system permission prompts and platform background/foreground rules remain authoritative.

The product should distinguish `ready for speech` from `recording/transmitting speech` where the underlying platform permits that distinction, and the UI should communicate the actual state accurately.

## Progressive clarification

The AI should not interrogate the user for every possible field before providing value.

Use progressive profiling:

1. learn enough to create a useful initial agenda
2. clearly identify assumptions where necessary
3. begin helping
4. learn additional context naturally through subsequent conversations and execution events
5. ask focused clarification only when it materially improves a decision

This reduces onboarding abandonment and allows personalization to emerge over time.

## Voice-first, not voice-only

Voice should be prioritized without making speech mandatory.

Users may be in meetings, public spaces, quiet environments, noisy environments, or situations where speaking is impossible or undesirable. Users may also have speech, hearing, cognitive, visual, motor, or other accessibility needs that make different modalities preferable.

Equivalent paths should therefore remain available through:

- speech
- text
- touch
- swipe/gesture
- assistive technologies supported by the host platform

The system should remember modality preferences where authorized and appropriate.

## Conversational command model

Common actions should be expressible naturally rather than through menu navigation.

Examples:

- "What's next?"
- "I finished the workout."
- "That took about 45 minutes longer than we expected."
- "Move the proposal to tomorrow morning."
- "I'm exhausted. Rework the rest of today but keep the client deadline protected."
- "I have an unexpected meeting at three."
- "Don't schedule work after six this week."
- "I want to make more progress on my business without giving up my Sundays."
- "Why did you put this first?"
- "I didn't do it because I was waiting on someone else."
- "Undo that. I swiped the wrong way."
- "That task was much harder than I expected."
- "I figured out a faster way to do that next time."

The application should convert conversational intent into normalized core operations and return a concise confirmation when state changes.

## Optional task reflections

A completion or non-completion response should never require the user to justify themselves. However, the user may voluntarily attach a reflection to any task by speaking, typing, or another supported modality.

Examples include:

- "It was more difficult than I imagined."
- "The instructions were unclear."
- "I was waiting on someone else."
- "It only took 20 minutes."
- "I was interrupted twice."
- "I learned how to automate part of this."
- "This probably does not need to be done every week."

These reflections should be stored separately from the binary task outcome so the system can learn from them without treating subjective comments as objective facts.

Useful normalized signals may include:

- perceived difficulty
- actual or estimated duration correction
- blocker/dependency context
- interruption context
- emotional/energy context when voluntarily supplied
- discovered efficiency
- suggested process change
- relevance/value reassessment
- freeform note

Reflections can improve future duration estimates, prioritization, automation/delegation suggestions, and coaching. They should not be required for ordinary check-ins.

The system should distinguish user-authored observations from AI-derived interpretations and preserve provenance.

## Confirmation and authority

Voice convenience must not eliminate user control.

Low-risk reversible updates can generally use lightweight confirmation through the resulting state (for example, "Done — moved it to tomorrow at 9").

Consequential, ambiguous, externally visible, financial, destructive, or difficult-to-reverse actions should use stronger confirmation or existing OpenRabbit approval policy.

The system should distinguish conversational understanding from authorization.

## Swipe and voice together

The previously proposed swipe interaction remains valuable as an extremely fast check-in:

- right: completed
- left: not completed
- undo: reverse an accidental response

But it should not be the only path. The same check-in can happen by speech:

- "Done."
- "No, I didn't finish it."
- "I finished it around 12:15."
- "Not done — the meeting ran over."

Speech can provide richer context in one interaction while swipe provides speed when context is unnecessary.

## Accessibility

Voice-first design can reduce motor and typing burden, but speech itself must not be treated as universally accessible.

Accessibility requirements should include:

- no critical workflow that requires a gesture only
- no critical workflow that requires speech only
- clear text equivalents for spoken prompts where possible
- compatibility with platform accessibility services
- sufficient time to respond to prompts
- reversible actions
- understandable confirmations
- user control over spoken output and notification behavior

Accessibility should be treated as an architectural requirement, not a later UI enhancement.

## Ambient interaction boundary

A future Living Agenda may support more ambient or hands-free experiences, but continuous background listening should not be assumed.

Foreground-ready voice is intentionally different from always-listening behavior: the user explicitly enables it, the app is visibly open, microphone state is obvious, and leaving the app suspends the listening session.

Microphone activation, recording, retention, transcription, and background behavior must be explicit, privacy-preserving, and understandable to the user. The product should minimize collection and avoid creating the impression that it is silently monitoring private life.

Voice-derived data should follow the same personal privacy boundary as other Living Agenda behavioral intelligence.

## Structured intelligence beneath conversation

The conversational layer should not become the source of truth.

Speech/text -> Intent/Entities -> Normalized Living Agenda operation -> Core state -> Confirmation

Examples of normalized operations include:

- create/update goal
- create/revise daily plan
- complete/not-complete plan item
- record execution timestamp/context
- attach task reflection
- correct/undo reflection or check-in
- reschedule
- mark blocked
- change availability/boundary
- request explanation
- approve/deny consequential action

This allows the UI and AI model to evolve without corrupting the underlying execution model.

## Product experience target

The ideal experience should feel less like operating productivity software and more like having an execution coach available through conversation.

The user should not need to think:

> Which screen contains the setting I need?

They should usually be able to say what they want:

> I need to get this done this week, but tomorrow is already overloaded. Figure out the best place for it without moving my workout or family time.

Living Agenda then translates intention into an explainable proposed action and, where appropriate, executes it.

## Near-term architecture implications

1. Model interactions as modality-neutral intents; do not encode core behavior around buttons.
2. Add conversational onboarding contracts that can incrementally populate goals, constraints, and preferences.
3. Add an explicit foreground-ready voice preference separate from OS microphone permission.
4. Keep swipe/check-in events compatible with equivalent voice/text commands.
5. Add optional, provenance-preserving task reflection events.
6. Preserve explicit timestamps and corrections regardless of input modality.
7. Build confirmations/approvals around action consequence, not whether the action originated from voice or touch.
8. Keep microphone/audio handling outside the provider-neutral execution core.
9. Treat accessibility and privacy as requirements of every interaction surface.
