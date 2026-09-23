# OpenRabbit onboarding accessibility certification — V1

Status: release-gate protocol  
Scope: production web `/onboarding` flow  
Primary issue: #83  
Baseline: WCAG 2.2 AA plus manual assistive-technology checks

## Purpose

The production onboarding flow now has semantic native controls, visible focus styling, reduced-motion handling, reload/back resume behavior, and deterministic focus transfer to the active step heading. Those implementation facts are not the same as browser-level accessibility certification.

This protocol defines the evidence required to close the remaining accessibility acceptance criterion in #83 without treating a successful lint/build, source review, or runtime unit test as a substitute for real interaction testing.

Normative references:

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices — Practices: https://www.w3.org/WAI/ARIA/apg/practices/
- W3C ACT visible-focus rule: https://www.w3.org/WAI/standards-guidelines/act/rules/oj04fd/

## Certification rule

The criterion is **PASS** only when:

1. the current production-web commit passes the repository's normal lint and production-build gates;
2. all automated checks available in the release environment pass with no unresolved serious/critical violations on `/onboarding`;
3. the keyboard-only scenario passes;
4. the reduced-motion scenario passes;
5. the touch scenario passes on at least one iOS Safari device and one Android Chrome device or equivalent real-device browser;
6. the screen-reader scenario passes on VoiceOver + Safari and NVDA + Chrome (or a documented equivalent when a platform is unavailable);
7. failures and waivers are recorded against the exact tested commit and browser/AT versions.

A source-level expectation is not evidence of a browser pass. A single browser is not sufficient evidence for the manual gate.

## Frozen test journey

Run the same six-step onboarding journey for each applicable modality:

1. Open `/onboarding` from a clean browser profile or cleared onboarding storage.
2. Select a work area.
3. Select at least two desired outcomes.
4. Add at least two existing-tool inventory entries without authorizing a provider.
5. Choose a starting state.
6. Select presentation preferences.
7. Reach the personalized preview and verify it is announced and visibly labeled **Simulated preview**.
8. Navigate backward at least two steps, change one choice, then continue forward.
9. Reload during the flow and verify the bounded draft resumes without losing valid choices.
10. Reset presentation preferences and verify the control/state change is perceivable without relying only on color.
11. Return to the preview and confirm no provider is represented as Connected or Verified merely from onboarding selections.

Use test-only categorical values; do not enter provider secrets or customer content.

## Keyboard-only acceptance

Use the keyboard from initial load through the preview. PASS requires:

- every actionable control is reachable without a pointer;
- tab order follows the visual/logical reading order;
- focus never becomes lost, trapped, or placed on hidden/inert content;
- focus is visibly perceivable on every sequentially focusable control;
- Continue/Back step changes move programmatic focus to the newly active step heading as designed;
- Enter/Space activates native controls consistently with browser semantics;
- no action requires hover, drag, multipoint gesture, or timing-sensitive input;
- returning backward does not unexpectedly reset focus to the browser chrome or document body;
- the preview can be reached and edited without using a mouse.

Record the first failing control, step, key sequence, and screenshot/video evidence for any failure.

## Screen-reader acceptance

Minimum manual matrix:

| Platform | Browser | Assistive technology | Required |
| --- | --- | --- | --- |
| macOS | Safari | VoiceOver | yes |
| Windows | Chrome | NVDA | yes |

For each matrix row, PASS requires:

- page title and main landmark are discoverable;
- the current step heading is announced after Continue and Back transitions;
- form controls expose useful accessible names that match visible labels;
- selection state is announced for checkbox/radio-style controls;
- progress information is understandable without inferring it from graphics alone;
- error/invalid state, if triggered, is announced with a useful relationship to the affected control;
- the simulated preview label is announced before or with preview content so simulated data cannot be mistaken for live data;
- tool inventory choices are not announced as connected/authorized;
- reset/edit controls communicate their purpose and changed state;
- no decorative icon or duplicate text creates confusing repeated announcements;
- reading order remains coherent at each step and in the preview.

Record the exact AT/browser versions and the spoken output for any ambiguous control.

## Touch acceptance

Minimum manual matrix:

| Platform | Browser | Required |
| --- | --- | --- |
| iOS/iPhone | Safari | yes |
| Android phone | Chrome | yes |

PASS requires:

- all primary controls can be activated with a single pointer/tap;
- touch targets are practically usable without precision tapping or overlap;
- viewport zoom/orientation changes do not hide Continue, Back, Reset, or required form content;
- no essential content is available only on hover;
- the six-step journey, backward edits, reload/resume, reset, and preview can be completed without desktop-only behavior;
- on-screen keyboard appearance does not permanently obscure the active control or navigation action.

If a real-device platform is unavailable, keep #83 open and record the missing matrix row rather than substituting a desktop responsive viewport and calling the manual gate complete.

## Reduced-motion acceptance

With the operating system/browser preference set to `prefers-reduced-motion: reduce`:

- complete the full frozen journey;
- verify step changes do not require motion to understand state;
- verify any nonessential animation/transition is removed or materially reduced;
- verify focus transfer still works and is not delayed until an animation completes;
- verify the preview remains fully understandable.

## Automated check boundary

Automated scanners are useful for detectable semantics, names, contrast, landmarks, duplicate IDs, and related rules, but they do not certify focus quality, screen-reader comprehension, touch usability, or the truthfulness of simulated/live state. Automated results are supporting evidence only.

For each release candidate, record:

- exact commit SHA;
- deployed/test URL or local production-build identity;
- scanner/tool and version;
- violation count by severity;
- disposition of every serious/critical result;
- link to the retained report when available.

## Evidence record

Create one certification record per tested release candidate with this structure:

```text
Commit SHA:
Test date (UTC):
Tester:
Build/deploy identity:

Automated scan:
- tool/version:
- serious/critical findings:
- result: PASS / FAIL

Keyboard:
- browser/version:
- result: PASS / FAIL
- evidence/issues:

Reduced motion:
- browser/version:
- result: PASS / FAIL
- evidence/issues:

Touch iOS Safari:
- device/OS/browser:
- result: PASS / FAIL / NOT RUN
- evidence/issues:

Touch Android Chrome:
- device/OS/browser:
- result: PASS / FAIL / NOT RUN
- evidence/issues:

VoiceOver + Safari:
- versions:
- result: PASS / FAIL / NOT RUN
- evidence/issues:

NVDA + Chrome:
- versions:
- result: PASS / FAIL / NOT RUN
- evidence/issues:

Overall: PASS / FAIL
Open defects/waivers:
```

A `NOT RUN` result on a required manual row keeps the overall result at FAIL/not certified.

## Release consequence

- **PASS:** the remaining accessibility acceptance criterion in #83 may be checked only for the tested commit or a later commit whose onboarding-relevant changes are re-evaluated.
- **FAIL:** keep #83 open; fix the defect and rerun the affected matrix rows plus any regression-sensitive rows.
- **UI/interaction change after PASS:** rerun the relevant manual and automated evidence before carrying certification forward.

This protocol certifies the onboarding interaction surface only. It does not certify production identity/data boundaries, provider OAuth lifecycle, tenant isolation, or the broader OpenRabbit application.
