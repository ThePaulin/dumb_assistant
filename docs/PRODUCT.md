# Product Scope

## Problem

Conventional reminder and calendar forms make users translate an everyday intention into fields before they can save it. They are particularly awkward when a schedule has intervals, active hours, or stopping criteria.

Dumb Assistant lets a user express the intention naturally and converts it into a precise, inspectable schedule.

## Primary user

The MVP is for an individual who wants to capture commitments quickly while walking, driving, cooking, or moving between tasks. It is not initially designed for teams, families, or shared scheduling.

## Core job to be done

When I remember something I need to do, let me say it naturally and quickly turn it into a reminder I can trust, so I do not have to navigate a complex form or remember it again later.

## Product promise

Speak naturally for a few seconds, and the app turns the request into a correct, dependable reminder or event with minimal editing.

## Core workflow

1. The user starts voice capture or enters text.
2. The app transcribes voice input when applicable.
3. The interpretation layer proposes a structured reminder or event.
4. Deterministic validation rejects invalid or unsupported schedules.
5. The app shows a human-readable preview.
6. If a critical field is missing or ambiguous, the app asks one focused question.
7. The user confirms or edits the proposal.
8. The app saves the item and schedules notifications.
9. The user can complete, snooze, reschedule, pause, resume, or delete it.

## MVP objects

### Reminder

A reminder represents an action and one or more times when the user should be notified.

Required capabilities:

- Title
- Optional notes
- Start date and time
- Time zone
- One-time or recurring schedule
- Snooze
- Active, paused, ended, and completed states
- Completion history sufficient to calculate completion-relative recurrence

### Event

An event occupies a time range. Events are secondary to reminders in the MVP.

Required capabilities:

- Title
- Start date and time
- Optional end time or duration
- Optional location and notes
- One or more alerts
- Basic recurrence using the same supported recurrence model where practical

Events remain inside the app during the MVP. Device-calendar synchronization is deferred.

## Voice and text interpretation

The interpretation layer should extract:

- Intent: reminder or event
- Action or title
- Date and time
- Duration or end time
- Recurrence
- Stopping condition
- Active-hour window
- Relevant notes
- Missing or uncertain critical fields

The interpretation layer produces a versioned structured object. It does not directly schedule notifications.

## Ambiguity policy

- Never invent a critical date, time, or recurrence rule without showing it clearly.
- Ask a focused question when an item cannot be scheduled safely.
- Ask one clarification question at a time.
- Prefer an explicit failure or unsupported response over a plausible but incorrect schedule.
- Always allow the proposed interpretation to be edited before saving.
- Preserve the transcript during confirmation so the user can compare input with output.

Example:

> Remind me to call Sam later.

The app should ask when the reminder should occur rather than silently choosing a time.

## Essential product surfaces

1. **Today / Upcoming** — upcoming reminders and events with quick actions.
2. **Voice capture** — recording state, transcript, cancel, and finish controls.
3. **Interpretation preview** — structured proposal, clarification, confirm, and edit actions.
4. **Item editor** — complete manual creation and editing fallback.
5. **Item details** — schedule, next occurrence, status, and history.
6. **Settings** — notification permissions, defaults, time-zone behavior, and privacy controls.

## Functional requirements

### Creation

- Users can create all supported schedules manually.
- Voice and text input use the same interpretation contract.
- A proposed item is not persisted as active until it is confirmed.
- Unsupported schedules are explained and remain editable.

### Management

- Users can inspect the next occurrence of every active item.
- Users can edit, pause, resume, reschedule, or delete an item.
- Users can complete or snooze from the app and, where supported, from a notification.
- Changes reconcile previously scheduled notifications.

### Reliability

- Saved schedules survive application restarts and upgrades.
- Notification permission problems are visible and actionable.
- Schedule generation is deterministic and testable without an AI service.
- The app avoids duplicate notifications after edits or restarts.

### Accessibility

- Core flows are usable with screen readers.
- Controls have accessible labels and appropriate touch targets.
- Dynamic text does not hide critical schedule details or actions.
- Voice is never the only method for completing a core workflow.

## Non-functional requirements

- Mobile support for iOS and Android from a shared codebase.
- Local-first storage for confirmed reminders, events, and recurrence state.
- Graceful offline behavior for previously created schedules.
- Versioned interpretation and persistence schemas.
- Privacy-conscious logging that excludes audio and transcript content by default.
- Automated testing of recurrence and migration behavior.

## Success measures

The MVP should answer:

1. Is voice faster or easier than a conventional form for real reminder capture?
2. Is interpretation accurate enough to earn user trust?
3. Is flexible recurrence valuable enough to drive repeated use?

Initial measures:

- Percentage of voice requests confirmed without editing
- Percentage requiring clarification
- Field-level correction rate
- Time from capture start to confirmed item
- Notification scheduling and delivery success
- Completion and snooze interaction rate
- Seven-day and thirty-day reuse
- User-rated confidence in schedule correctness

Initial interpretation target: at least 80% of ordinary supported requests should be confirmed without field editing. Critical scheduling fields should be held to a stricter standard than titles or notes.

## Deferred scope

- Accounts, backup, and cloud synchronization
- Shared items and collaboration
- External calendar synchronization
- Location-triggered reminders
- Always-listening operation
- Desktop and web applications
- Advanced analytics and gamification
- External service actions
- Full offline speech transcription or interpretation
- Attachments and task dependencies

## Open product questions

- Should transcripts be discarded immediately after confirmation or retained locally in item history?
- What should the default behavior be when a time zone changes?
- Which event recurrence combinations should be included in the MVP?
- What are the default snooze choices?
- Should a dismissed notification remain overdue, be marked complete, or remain untouched?
- How should missed occurrences inside an active window be represented?
