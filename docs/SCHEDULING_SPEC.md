# Scheduling Specification

This document defines the intended MVP scheduling semantics. It is a living specification: update it before or alongside behavior changes and cover each rule with automated tests.

## Design rules

- Scheduling is deterministic and independent of the interpretation provider.
- Persist the user's schedule definition, not only generated notification timestamps.
- Store absolute instants in UTC and retain the schedule time zone needed to generate future occurrences.
- Make the next occurrence visible to the user.
- Validate all proposed schedules before activation.
- Use explicit types for recurrence and stopping rules rather than free-form text.

## Conceptual model

The names below are conceptual and do not prescribe a programming language.

```text
ScheduledItem
  id
  kind: reminder | event
  title
  notes?
  status: draft | active | paused | ended | deleted
  schedule
  notificationPolicy
  createdAt
  updatedAt

Schedule
  start
  timeZone
  recurrence?
  activeWindow?
  stopRule?
  recurrenceAnchor: fixed | completion

Recurrence
  interval
  weekdays?
  timesOfDay?

StopRule
  never | onDate | afterOccurrences | manually
```

The implementation will likely need additional types for occurrences, completions, snoozes, notification registrations, and schema versions.

## Supported recurrence

The MVP supports:

- One-time schedules
- Every `N` minutes
- Every `N` hours
- Every `N` days
- Every `N` weeks
- Every `N` months
- Selected weekdays
- Multiple explicit times per day
- An optional daily active window

Not every field combination must be legal. Valid combinations should be enumerated during Milestone 0 rather than accepted accidentally.

## Recurrence anchors

### Fixed

Occurrences are calculated from the original schedule and do not move when an occurrence is completed late.

Example: a reminder scheduled every day at 9:00 AM continues at 9:00 AM regardless of completion time.

### Completion-relative

The next occurrence is calculated from the completion time of the current occurrence.

Example: a reminder to replace a dressing every three days, completed Monday at 2:00 PM, is next due Thursday at 2:00 PM.

Completion-relative schedules require an explicit product decision for skipped, missed, or never-completed occurrences. Until resolved, they must not silently generate a chain of overdue occurrences.

## Active windows

An active window limits valid occurrences within a local day.

Example:

```text
Every 3 hours
Start: 9:00 AM
Active window: 9:00 AM–6:00 PM
```

Expected daily occurrences are 9:00 AM, 12:00 PM, 3:00 PM, and 6:00 PM when the window end is inclusive.

The implementation must explicitly decide and test:

- Whether the end boundary is inclusive
- Whether overnight windows are supported
- Whether the interval resets at the start of each daily window
- What happens when the start does not align with the window

Recommended MVP defaults:

- End boundaries are inclusive.
- Overnight windows are unsupported initially.
- Interval schedules restart from the first valid time in each daily window.

## Stopping rules

Supported stopping behavior:

- Never: continues until manually stopped
- On date: no occurrence after the specified local end date
- After occurrences: ends after `N` generated occurrences
- Manually: semantically equivalent to never, with an explicit user-facing stop action

The implementation must distinguish generated, delivered, completed, skipped, and snoozed occurrences. The occurrence-count stopping rule should count generated scheduled occurrences unless a later product decision changes it.

## Snooze

Snoozing changes the notification time for one occurrence. It does not alter a fixed recurrence schedule.

For completion-relative recurrence, snoozing also does not change the recurrence anchor; completing the snoozed occurrence does.

## Pause and resume

- Pausing prevents future notification delivery without deleting the schedule.
- Resuming recalculates the next valid occurrence from the current time.
- Missed occurrences are not delivered in a burst on resume.
- Pausing does not reset an after-occurrences counter.

## Editing

- Editing a schedule invalidates future generated occurrences and notification registrations.
- Historical occurrences and completion records are retained unless the item is explicitly deleted.
- The updated schedule is validated and regenerated atomically where practical.
- A failed notification reconciliation must be surfaced instead of reporting full success.

## Time zones and daylight saving time

The MVP must distinguish wall-clock schedules from elapsed-duration schedules.

- A daily reminder at 9:00 AM should remain at 9:00 AM in its configured time zone across daylight-saving changes.
- An every-3-hours reminder represents elapsed intervals while active, subject to its configured local active window.
- The app must record whether a schedule follows the device's current time zone or stays attached to the original time zone. This product behavior remains open.
- Nonexistent or repeated local times during daylight-saving transitions require deterministic resolution and automated tests.

## Notification reconciliation

On launch and after any schedule mutation, the system should compare desired future occurrences with registered platform notifications.

It must:

- Remove obsolete registrations.
- Avoid duplicate registrations.
- Refill the future scheduling window when platform limits prevent registering every occurrence.
- Record enough metadata to associate a delivered notification with its item and occurrence.
- Never treat notification registration as proof of delivery.

## Validation examples

Valid examples:

- Tomorrow at 3:00 PM
- Every two days starting Monday
- Weekdays at 8:30 AM
- Daily at 8:00 AM and 9:00 PM
- Every three hours between 9:00 AM and 6:00 PM through Friday
- Three days after each completion, stopping after ten occurrences

Examples requiring clarification:

- Later today
- Remind me regularly
- Every few hours
- Call Sam next week
- Twice a day, without preferred times or permission to choose defaults

Initially unsupported examples:

- Every third business day except holidays
- Whenever I arrive at work
- The last weekday before the end of every fiscal quarter
- Remind me more often if I keep ignoring it

## Required test categories

- Start and stop boundaries
- Inclusive and exclusive time comparisons
- Multiple daily times
- Weekday transitions
- Month lengths and leap years
- Daylight-saving gaps and repeated times
- Device time-zone changes
- Pause and resume
- Edits after occurrences have been generated
- Snooze versus recurrence
- Completion-relative calculations
- Application restart and notification reconciliation
- Persistence schema migrations
