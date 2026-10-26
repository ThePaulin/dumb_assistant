# Roadmap

This roadmap tracks outcomes rather than calendar promises. Dates and estimates should be added only after Milestone 0 resolves the largest product and technical unknowns.

## Progress summary

| Milestone | Status | Outcome |
| --- | --- | --- |
| 0. Product and scheduling specification | Complete | The supported product behavior is explicit and testable |
| 1. End-to-end technical spike | Complete | The local vertical architecture works in an iOS simulator; hardware qualification is deferred |
| 2. Deterministic reminder engine | Complete | Supported schedules behave correctly without AI |
| 3. Usable manual product | Not started | The complete product works without voice |
| 4. Voice-first creation | Not started | Natural input becomes a safe, editable proposal |
| 5. Interpretation quality | Not started | Accuracy is measured and regressions are detectable |
| 6. Reliability and hardening | Not started | Reminders remain dependable under real mobile conditions |
| 7. Private beta | Not started | External users validate usefulness and trust |
| 8. MVP release candidate | Not started | The product is ready for store submission |

Allowed statuses: `Not started`, `In progress`, `Blocked`, `Complete`.

## Milestone 0 — Product and scheduling specification

Deliverables:

- [x] MVP product definition
- [x] Initial in-scope and deferred-scope boundaries
- [x] Initial reminder and event concepts
- [x] Initial recurrence semantics
- [x] Resolve open recurrence behavior in `SCHEDULING_SPEC.md`
- [x] Define the versioned interpretation JSON schema
- [x] Define the persistence/domain model in implementation-ready detail
- [x] Create at least 50 representative phrases with expected structured outputs
- [x] Complete low-fidelity flows for the essential screens
- [x] Decide transcript and audio retention behavior
- [x] Select the cross-platform framework using a short comparison
- [x] Select local persistence and date/time libraries
- [x] Decide whether the AI path requires a minimal backend for credential protection

Exit criteria:

- [x] At least 50 representative phrases have agreed expected outputs.
- [x] Every supported schedule maps cleanly to the data model.
- [x] Unsupported requests have defined fallback behavior.
- [x] Reminder and event terminology is consistent across documentation and wireframes.
- [x] Foundational technical choices are recorded in `DECISIONS.md`.

## Milestone 1 — End-to-end technical spike

Deliverables:

- [x] Cross-platform application shell
- [x] Microphone capture
- [x] Downloadable on-device speech and language models
- [x] On-device speech transcription
- [x] Structured local interpretation of a limited phrase set
- [x] Optional OpenRouter OAuth PKCE connection and compatible-model request
- [x] Minimal confirmation preview
- [x] One-time local notification
- [x] Basic timing, error, and cost instrumentation

Exit criteria:

- [x] The native development build installs, starts, and completes the vertical flow in an iOS simulator.
- [x] With models cached, a one-time reminder can be interpreted locally, reviewed, confirmed, persisted, and registered with the simulator notification service without a provider request.
- [x] The simulator microphone denial/retry and local transcription pipeline execute; representative real-speech accuracy is explicitly deferred to hardware qualification.
- [x] Invalid model output cannot create a malformed schedule.
- [x] Three local interpretation candidates, simulator latency, model size, failure behavior, and the provisional selection are documented.
- [x] Physical memory, thermal, battery, notification delivery, Android, and full-corpus accuracy gates are transferred to Milestone 6/private beta.
- [x] The optional remote path and privacy boundary are implemented; account-bound latency, cost, routing, and revocation checks are deferred until explicitly authorized.

## Milestone 2 — Deterministic reminder engine

Deliverables:

- [x] Local persistence and migrations
- [x] Schedule validation
- [x] Occurrence generation
- [x] Time-zone-aware date handling
- [x] One-time reminders
- [x] Every-N-unit recurrence
- [x] Weekday recurrence
- [x] Multiple times per day
- [x] Active-hour windows
- [x] End date, occurrence count, and manual-stop rules
- [x] Fixed and completion-relative recurrence
- [x] Pause, resume, complete, snooze, reschedule, and delete operations
- [x] Notification scheduling and reconciliation
- [x] Automated schedule test suite

Exit criteria:

- [x] All supported scheduling examples pass automated tests.
- [x] Restarting the app does not lose or duplicate schedules.
- [x] Editing or deleting an item reconciles pending notifications.
- [x] Daylight-saving and time-zone behaviors are defined and tested.
- [x] The scheduling engine has no AI dependency.

## Milestone 3 — Usable manual product

Deliverables:

- [ ] Today/upcoming screen
- [ ] Reminder and event detail screens
- [ ] Manual creation and editing
- [ ] Recurrence editor
- [ ] Completion and snooze interactions
- [ ] Paused, ended, and completed states
- [ ] Notification-permission onboarding
- [ ] Empty, loading, and error states
- [ ] Initial accessibility implementation

Exit criteria:

- [ ] Every supported item can be created and managed without voice.
- [ ] The next scheduled occurrence is always visible.
- [ ] Item status is unambiguous.
- [ ] Core workflows work with screen readers and larger text sizes.

## Milestone 4 — Voice-first creation

Deliverables:

- [ ] Polished recording interface
- [ ] Recording cancellation and recovery
- [ ] Transcript display
- [ ] Text input through the same interpretation pipeline
- [ ] Structured extraction for reminders and events
- [ ] Confirmation preview
- [ ] Field uncertainty handling
- [ ] Single-question clarification flow
- [ ] Manual correction from the preview
- [ ] Clear network and interpretation error recovery

Exit criteria:

- [ ] Common requests can be confirmed without opening the full editor.
- [ ] Ambiguous critical fields trigger clarification instead of invention.
- [ ] Every interpreted field can be corrected before saving.
- [ ] Voice and text produce the same structured contract.

## Milestone 5 — Interpretation quality and evaluation

Deliverables:

- [ ] Expanded evaluation corpus
- [ ] Automated expected-versus-actual comparison
- [ ] Field-level accuracy reporting
- [ ] Failure classification
- [ ] Prompt, provider, model, and schema version tracking
- [ ] Privacy-conscious feedback or diagnostic export

Exit criteria:

- [ ] At least 80% of ordinary supported requests require no field correction.
- [ ] Critical schedule fields meet their agreed stricter threshold.
- [ ] Unsupported requests are rejected or clarified, not mis-scheduled.
- [ ] Interpretation regression tests run before releases.

## Milestone 6 — Reliability and platform hardening

Deliverables:

- [ ] Notification reconciliation after restart
- [ ] Permission-change detection
- [ ] Device-restart recovery where applicable
- [ ] Background and foreground behavior validation
- [ ] Notification action handling
- [ ] Platform notification-limit strategy
- [ ] Clock, time-zone, and daylight-saving change handling
- [ ] Offline-state behavior
- [ ] Data migrations
- [ ] Crash reporting and privacy-conscious diagnostics
- [ ] Battery and performance review

Exit criteria:

- [ ] A multi-day physical-device test has no lost or duplicate reminders.
- [ ] Permission problems are visible and actionable.
- [ ] Schedule edits are reflected in notification registrations.
- [ ] Previously created reminders behave predictably offline.
- [ ] User data survives application upgrades.

## Milestone 7 — Private beta

Deliverables:

- [ ] Onboarding with example phrases
- [ ] In-app feedback
- [ ] Privacy disclosures
- [ ] Basic product analytics
- [ ] TestFlight and Android testing-track distribution
- [ ] Structured beta plan
- [ ] Bug and interpretation-failure triage process

Exit criteria:

- [ ] External users complete at least two weeks of testing.
- [ ] Confirmation and correction rates are measurable.
- [ ] Delivery failures can be distinguished from interpretation failures.
- [ ] No unresolved data-loss or notification-reliability defects remain.
- [ ] Users repeatedly create real reminders beyond onboarding examples.

## Milestone 8 — MVP release candidate

Deliverables:

- [ ] Final UX and accessibility pass
- [ ] Store assets and descriptions
- [ ] Privacy policy and support path
- [ ] Release monitoring
- [ ] Local data export or backup decision
- [ ] Regression suite across supported devices and OS versions
- [ ] Documentation of unsupported schedules

Release gates:

- [ ] Core flows are crash-free under normal use.
- [ ] Notification reliability meets the agreed threshold.
- [ ] Interpretation quality meets Milestone 5 targets.
- [ ] High-severity accessibility, privacy, and data-integrity issues are resolved.
- [ ] Store review requirements are satisfied.

## Dependency overview

```text
Specification
     |
     v
Technical spike
     |
     v
Reminder engine ----------> Reliability hardening
     |                              |
     v                              v
Manual product -> Voice creation -> Private beta -> Release
                         |
                         v
                Interpretation evaluation
```
