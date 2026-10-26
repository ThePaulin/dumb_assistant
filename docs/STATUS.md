# Project Status

Last updated: 2026-10-26

## Current milestone

**Milestone 0 — Complete. Milestone 1 — Ready to start.**

## Current objective

Build the Milestone 1 end-to-end technical spike: local voice capture, on-device transcription, on-device interpretation, preview, confirmation, persistence, and one local notification.

## Completed

- Defined the MVP product promise.
- Chose reminders as the hero feature and basic events as secondary.
- Chose a voice-first, not voice-only, interaction model.
- Chose local-first data with no MVP account or cloud synchronization.
- Deferred device-calendar synchronization.
- Included completion-relative recurrence in the MVP.
- Established the initial project documentation and milestone roadmap.
- Resolved recurrence boundaries, missed/overdue behavior, time-zone policy, and DST behavior.
- Defined versioned interpretation and scheduled-item JSON schemas.
- Defined the SQLite v1 domain and persistence model.
- Added 70 representative interpretation cases with structured expected results.
- Completed low-fidelity flows for every essential screen.
- Selected Expo/React Native, SQLite, Temporal semantics, and a pure TypeScript recurrence engine.
- Selected on-device Whisper and compact-model inference as the default AI path.
- Selected optional user-authorized OpenRouter inference and rejected a mandatory backend for the MVP.
- Defined audio/transcript retention and model qualification gates.

## In progress

No implementation work has started. The repository is ready for Milestone 1 scaffolding.

## Next up

1. Scaffold an Expo SDK 58 development-build project with strict TypeScript.
2. Prove local notification scheduling and cancellation on physical iOS and Android devices.
3. Prove local Whisper transcription and measure Tiny versus Base.
4. Evaluate the compact interpretation candidates against the 70-case corpus.
5. Implement schema/domain validation and the confirmation preview.
6. Persist one confirmed reminder and reconcile its notification.
7. Validate OpenRouter OAuth PKCE and one structured-output-compatible endpoint.

## Current risks

| Risk | Impact | Current mitigation |
| --- | --- | --- |
| Plausible but incorrect AI interpretation | Users lose trust or miss commitments | Structured preview, deterministic validation, focused clarification |
| Mobile notification restrictions | Reminders may not be registered or delivered as expected | Notification adapter, reconciliation, physical-device reliability testing |
| Recurrence scope grows without limit | MVP becomes slow and difficult to explain | Explicit supported model and unsupported examples |
| Compact local model misses critical fields | Incorrect reminders or loss of trust | 70-case corpus, 95% critical-field gate, deterministic validation |
| Model download or memory pressure excludes older devices | Voice intelligence may be unavailable | Capability checks, removable downloads, manual mode, optional OpenRouter |
| User-authorized remote key is exposed | User-funded inference could be abused | OAuth PKCE, secure storage, credit-limit guidance, disconnect/revoke flow |
| Privacy concerns around voice | Users may avoid the primary interaction | Minimize retention, disclose remote processing, privacy-safe logs |

## Blockers

None currently.

## How to update this file

- Update the date when status changes materially.
- Keep the active objective to one outcome.
- Move completed items out of “In progress.”
- Record blockers with an owner or the decision needed to unblock them.
- Keep detailed task checklists in `ROADMAP.md`; use this file as a concise project snapshot.
