# Scheduling Specification

This document is the source of truth for MVP scheduling semantics. Behavior changes must update this specification and its automated tests together.

## Design rules

- Scheduling is deterministic and independent of transcription or interpretation providers.
- Persist the user's schedule definition, not only generated notification timestamps.
- Persist exact instants in UTC and retain the IANA time-zone identifier and wall-clock fields used to generate them.
- Show the next occurrence and the time-zone policy to the user.
- Validate every proposed schedule before activation.
- Use explicit types for recurrence and stopping rules rather than free-form recurrence text.
- Generate occurrences idempotently: the same item, revision, and time range must produce the same occurrence identities.

## Supported schedule forms

### One-time

One occurrence at a resolved local date and time.

### Interval

Every positive integer `N` minutes, hours, days, weeks, or months.

### Selected weekdays

One or more weekdays at one or more explicit times of day. Weekdays use ISO numbering: Monday `1` through Sunday `7`.

### Multiple times per day

One or more explicit local times on each eligible day.

### Active window

An optional non-overnight local-time window that limits minute- or hour-based interval occurrences within each eligible day.

## Valid combinations

| Schedule form | Allowed options | Disallowed combinations |
| --- | --- | --- |
| One-time | Time-zone policy, event duration, alerts | Recurrence anchor or stop rule |
| Minute/hour interval | Active window, start, stop rule, fixed or completion anchor | Selected weekdays with completion anchor; overnight active window |
| Day/week/month interval | Explicit time, start, stop rule, fixed or completion anchor | Active window unless the unit is minute/hour |
| Selected weekdays | One or more weekdays and times, start, stop rule, fixed anchor | Completion anchor |
| Multiple daily times | One or more times, start, stop rule, fixed anchor | Completion anchor |
| Event recurrence | Fixed anchor and any otherwise-valid fixed schedule | Completion anchor and active windows |

An interpretation that produces an illegal combination becomes `needs_clarification` when one choice can resolve it, otherwise `unsupported`.

## Boundary semantics

- Start date/time is inclusive.
- Active-window start and end are inclusive.
- End dates are inclusive in the schedule's effective time zone.
- `after_occurrences` counts generated due occurrences, not notification deliveries or completions.
- A bare recurrence with no end continues until manually stopped.
- The first occurrence is the first valid occurrence on or after the inclusive start.
- Seconds are normalized to `00` for user-authored schedules in the MVP.

## Fixed recurrence

Fixed occurrences are calculated from the original schedule and never move because an earlier occurrence was completed, snoozed, or dismissed late.

Example: a daily 9:00 AM reminder continues at 9:00 AM even if Monday's occurrence is completed at 11:00 AM.

### Missed fixed occurrences

- The app never replays multiple old notifications in a burst.
- When reconciliation discovers past unregistered occurrences, it records them as `missed`.
- The most recent unresolved occurrence may be shown as overdue in the app.
- A future fixed occurrence is still generated and scheduled normally.
- Completing an overdue occurrence does not change the future schedule.

## Completion-relative recurrence

The next occurrence is calculated from the resolution time of the current occurrence.

- Only reminders support completion-relative recurrence in the MVP.
- Only one unresolved occurrence may exist at a time.
- If the current occurrence is never completed, no successor is generated; it remains overdue.
- Dismissing its notification does not resolve it.
- Snoozing changes only that occurrence's next alert time.
- Completing the occurrence sets the next anchor to the completion timestamp.
- The MVP has no separate “skip” action. A user can complete, reschedule, pause, or stop the reminder.
- Pausing freezes the unresolved occurrence. Resuming restores it; it does not create a successor.
- `after_occurrences` counts each generated occurrence, including the first.

Calendar units preserve wall-clock intent. For example, “one month after completion” uses the same local time and the original preferred day-of-month rule. Minute and hour units use elapsed duration, then must satisfy any active window.

## Active windows

Example:

```text
Every 3 hours
Start: 9:00 AM
Active window: 9:00 AM–6:00 PM
```

The daily occurrences are 9:00 AM, 12:00 PM, 3:00 PM, and 6:00 PM.

MVP rules:

- Window boundaries are inclusive.
- The end must be later than the start on the same local day.
- Overnight windows are unsupported.
- Fixed interval schedules reset at the active-window start each eligible day.
- A later schedule start clips the first day's sequence to occurrences on or after that start.
- An interval that does not land exactly on the inclusive end does not create an extra end occurrence.
- A completion-relative result outside the active window moves to the next eligible instant: before the window moves to its start; after the window moves to the next day's start.

## Weekday and phrase resolution

- `weekday` means Monday through Friday.
- A bare named weekday means its next future occurrence; if today is that weekday, it means seven days later.
- “This Friday” means Friday in the current ISO week when it is still in the future; otherwise it requires clarification.
- “Next Friday” means Friday in the following ISO week.
- “Tomorrow” means the next local calendar day, not 24 elapsed hours.
- “Twice a day” without times requires clarification. The app does not invent default times.
- “Morning,” “afternoon,” “evening,” “later,” “regularly,” and “every few hours” require clarification unless the user has explicitly configured corresponding defaults in a future release.

Interpretation always receives a reference timestamp, locale, and IANA time zone. Relative expressions are resolved against that context before preview.

## Monthly recurrence

- The schedule retains a preferred day of month.
- If the preferred day does not exist, that month clamps to its final calendar day.
- A later month returns to the preferred day when it exists.
- Example: monthly on January 31 produces February 28 (or 29), then March 31.

Ordinal weekday rules such as “last business day” or “third Tuesday” are unsupported in the MVP.

## Stopping rules

- `never`: continue until manually stopped.
- `on_date`: generate no occurrence after the inclusive local end date.
- `after_occurrences`: end after `N` generated occurrences.

For a completion-relative reminder, reaching the generation count means no successor is generated after the final occurrence is resolved. The item becomes `ended` when its final occurrence is completed.

## Snooze, dismiss, and completion

- Snooze applies to one occurrence and does not change a fixed recurrence.
- Completing a completion-relative occurrence after a snooze uses the actual completion time as the next anchor.
- Dismissing a notification leaves the occurrence due or overdue.
- Snooze duration is elapsed time, not wall-clock arithmetic.
- Snoozing past a fixed reminder's next occurrence does not merge the two occurrences.
- If platform limits prevent registering both, the app must show the conflict and preserve both occurrence records.

## Pause, resume, reschedule, and delete

- Pausing cancels future notification registrations but retains the item and occurrence history.
- Resuming a fixed schedule generates the first future valid occurrence and records intervening due occurrences as missed without replaying them.
- Resuming a completion-relative schedule restores its unresolved occurrence or generates the first occurrence if none has existed.
- Rescheduling one occurrence creates an override for that occurrence; it does not mutate the series.
- Editing the series increments its revision, invalidates future generated occurrences, and reconciles notification registrations atomically where practical.
- Deleting an item cancels registrations and removes its local item, occurrences, overrides, and history in one transaction. There is no cloud tombstone in the MVP.

## Time-zone policy

Every schedule has one of two explicit policies:

- `follow_device`: preserve local wall-clock fields when the device time zone changes. This is the default for reminders and events created without an explicit zone.
- `fixed`: evaluate wall-clock fields in a stored IANA time zone. This is used when the user explicitly names or selects a time zone.

On a detected device time-zone change, all active `follow_device` schedules are regenerated and notifications reconciled. Existing occurrence history retains the effective zone and UTC instant that applied when each occurrence was generated.

## Daylight-saving transitions

The engine uses Temporal-compatible `compatible` disambiguation:

- A nonexistent local time during a forward clock change moves forward by the gap.
- A repeated local time during a backward clock change selects the earlier instant.

Examples and tests must cover both transitions in at least one IANA zone. The preview should display an adjustment warning when the initially requested local time does not exist.

## Events

- Events have a start and either an end or positive duration.
- Event end must be after start.
- Events support fixed recurrence only.
- Event alerts are offsets before the start; zero means “at start.”
- Alerts after the event start are unsupported in the MVP.
- An occurrence-count stop rule counts event occurrences.
- Events remain internal to the app and do not synchronize with device calendars.

## Notification reconciliation

The database is authoritative; operating-system notification registrations are a derived cache.

On launch, foregrounding, time-zone change, permission change, and every schedule mutation, reconciliation must:

- Calculate a bounded future occurrence window.
- Remove obsolete registrations.
- Avoid duplicate registrations using stable occurrence identifiers.
- Register the nearest eligible occurrences first when platform limits apply.
- Refill the window as occurrences resolve or the app becomes active.
- Persist the platform identifier and registration status.
- Surface registration failure separately from persistence success.
- Never treat registration as proof of delivery.

The exact horizon and registration cap are configuration values chosen after physical-device testing, not embedded in domain rules.

## Clarification versus unsupported

Clarify when one missing or ambiguous value can make the request schedulable, such as:

- Missing time
- Missing times for “twice a day”
- Ambiguous part of day
- Missing completion-relative versus fixed intent when wording does not establish it

Return unsupported when the requested trigger or recurrence is outside the MVP, such as:

- Location triggers
- Business or holiday calendars
- Conditional escalation based on ignored notifications
- Dependencies on external tasks or services
- Overnight active windows
- Ordinal weekday recurrence

The preview may offer a simpler editable alternative, but it must not silently substitute one.

## Required test categories

- Inclusive start, window, and end boundaries
- Invalid recurrence combinations
- Multiple times per day
- Weekday and relative-date resolution
- Month lengths, leap years, and preferred day clamping
- Daylight-saving gaps and repeated times
- Device time-zone changes for both policies
- Fixed missed occurrences and non-burst recovery
- Pause and resume
- Series edits and single-occurrence overrides
- Snooze, dismiss, and completion
- Completion-relative overdue and final-occurrence behavior
- Event duration and alert offsets
- Notification reconciliation and platform limits
- Persistence migrations and idempotent occurrence generation
