# Project Status

Last updated: 2026-10-26

## Current milestone

**Milestone 0 — Product and scheduling specification**

## Current objective

Turn the agreed product concept into implementation-ready scheduling semantics, structured contracts, test cases, and foundational technical decisions.

## Completed

- Defined the MVP product promise.
- Chose reminders as the hero feature and basic events as secondary.
- Chose a voice-first, not voice-only, interaction model.
- Chose local-first data with no MVP account or cloud synchronization.
- Deferred device-calendar synchronization.
- Included completion-relative recurrence in the MVP.
- Established the initial project documentation and milestone roadmap.

## In progress

- Resolving precise recurrence semantics and edge cases.
- Defining the structured interpretation contract.
- Preparing a representative phrase evaluation dataset.

## Next up

1. Resolve the open questions in `SCHEDULING_SPEC.md`.
2. Define JSON schemas for reminders, events, schedules, and interpretation proposals.
3. Create the first 50 phrase-to-structure examples.
4. Compare cross-platform frameworks against the app's notification, audio, and testing needs.
5. Decide whether remote transcription and interpretation require a minimal backend.
6. Produce low-fidelity flows for the essential screens.

## Current risks

| Risk | Impact | Current mitigation |
| --- | --- | --- |
| Plausible but incorrect AI interpretation | Users lose trust or miss commitments | Structured preview, deterministic validation, focused clarification |
| Mobile notification restrictions | Reminders may not be registered or delivered as expected | Notification adapter, reconciliation, physical-device reliability testing |
| Recurrence scope grows without limit | MVP becomes slow and difficult to explain | Explicit supported model and unsupported examples |
| Completion-relative semantics are underspecified | Duplicate, overdue, or drifting reminders | Resolve edge cases before engine implementation |
| Provider secrets in a mobile client | Credentials can be extracted or abused | Decide backend boundary before external AI integration |
| Privacy concerns around voice | Users may avoid the primary interaction | Minimize retention, disclose remote processing, privacy-safe logs |

## Blockers

None currently.

## How to update this file

- Update the date when status changes materially.
- Keep the active objective to one outcome.
- Move completed items out of “In progress.”
- Record blockers with an owner or the decision needed to unblock them.
- Keep detailed task checklists in `ROADMAP.md`; use this file as a concise project snapshot.
