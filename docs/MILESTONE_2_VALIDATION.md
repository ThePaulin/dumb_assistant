# Milestone 2 Validation

Date: 2026-10-26

## Outcome

Milestone 2 is complete. Supported schedule definitions are validated and expanded by a pure TypeScript engine with no transcription, interpretation, network, React, or platform-notification dependency. SQLite remains authoritative; operating-system registrations are reconciled as a bounded derived cache.

The current spike screen intentionally continues to confirm only one-time reminders. Milestone 3 owns the manual creation and management UI that will call the repository operations delivered here.

## Implemented scope

- Strict validation for item, event, recurrence, active-window, stopping-rule, and anchor combinations
- Stable occurrence identities derived from item, revision, and original UTC instant
- One-time and every-N minute, hour, day, week, and month generation
- Selected weekdays and one or more explicit daily times
- Inclusive active windows that reset their fixed interval each eligible local day
- Inclusive start/end boundaries and occurrence-count termination
- Preferred-day monthly clamping with recovery in later months
- Fixed recurrence and single-unresolved completion-relative recurrence
- Explicit `follow_device` and `fixed` IANA time-zone policies
- Temporal-compatible daylight-saving gap and fold handling, including adjustment flags
- Deterministic tomorrow, bare weekday, this weekday, and next weekday resolution
- Pause, resume, manual stop, complete, dismiss, snooze, single-occurrence reschedule, series edit, and delete semantics
- Transactional SQLite creation/materialization and mutation APIs
- Capped nearest-first notification planning, obsolete-registration cancellation, retry, and refill on launch
- Deterministic one-time occurrence and notification identifiers in the validated spike path

## Automated evidence

`npm run check` passes:

- Milestone 0 corpus validation: 70 interpretation fixtures
- Strict TypeScript compilation
- 76 unit and persistence tests across 9 files

The Milestone 2 tests cover:

- Inclusive start, active-window, and end boundaries
- Invalid recurrence combinations
- Multiple times per day and selected weekdays
- Relative-date and weekday resolution
- Leap years, month lengths, and preferred-day clamping
- Toronto daylight-saving gap and repeated-time behavior
- Follow-device regeneration and fixed-zone stability
- Fixed missed-occurrence recovery without replaying an old burst
- Pause, resume, manual stop, edit, snooze, dismiss, completion, and occurrence override behavior
- Completion-relative overdue/final-occurrence semantics
- Event duration and alert offsets
- Notification idempotency, replacement, platform caps, and nearest-first ordering
- Executable SQLite migration, unique occurrence/registration constraints, and cascade deletion

## Exit-criteria mapping

| Criterion | Evidence |
| --- | --- |
| Supported examples pass | Domain suite covers every schedule form and boundary named in `SCHEDULING_SPEC.md` |
| Restart does not lose or duplicate schedules | SQLite definitions persist independently of registrations; deterministic keys plus unique constraints and `INSERT OR IGNORE` make materialization idempotent |
| Edit/delete reconcile notifications | Series edits cancel old-revision occurrences and registrations before materializing the new revision; hard delete returns platform identifiers and cascades local rows |
| DST/time-zone behavior defined and tested | Compatible gap/fold behavior, wall-clock calendar recurrence, elapsed short intervals, and both zone policies have assertions |
| No AI dependency | All scheduling modules import only Temporal and other domain modules; proposal interpretation remains outside the engine |

## Intentionally deferred

Physical notification delivery, terminated/background behavior, device restart behavior, platform limit tuning, permission changes, and multi-day reliability remain Milestone 6 gates. These are platform qualification tasks, not missing deterministic-engine behavior.

