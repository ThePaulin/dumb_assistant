# Project Status

Last updated: 2026-10-26

## Current milestone

**Milestone 0 — Complete. Milestone 1 — In progress (implementation complete; device validation pending).**

## Current objective

Complete Milestone 1 physical-device validation on iOS and Android and record the required model, notification, resource, latency, memory, thermal, battery, and OpenRouter evidence.

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

- Expo SDK 58 development-build application shell with strict TypeScript and Expo Router.
- Local microphone capture, cache cleanup, Whisper transcription, compact-model interpretation, and removable model lifecycle controls.
- Provider-neutral schema plus semantic validation before preview, persistence, or scheduling.
- SQLite v1 migration, expiring interpretation drafts, transactional confirmation, and retryable notification registration.
- Optional OpenRouter OAuth PKCE with secure storage, copy-code fallback, structured output, cost metadata, and local validation.
- Privacy-safe timing/error/token/cost diagnostics.
- Automated validation/time tests, clean native prebuilds, and successful iOS/Android Hermes bundle exports.

## Next up

1. Run the offline voice-to-notification flow on one physical iOS and one physical Android device.
2. Exercise model download pause/resume/cancel/delete/reload and capture storage/memory evidence.
3. Measure Whisper Tiny versus Base and at least three compact interpretation candidates against the 70-case corpus.
4. Run repeated-use latency, battery, and thermal measurements.
5. Validate OpenRouter OAuth PKCE, key revocation, endpoint capability, latency, cost, and privacy settings.
6. Fill the device matrix in `MILESTONE_1_VALIDATION.md`, then mark the remaining roadmap gates complete.

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

- Physical iOS and Android devices are not attached to the current development environment, so notification receipt, offline inference, native memory, thermal, and battery gates cannot be truthfully completed here.
- OpenRouter authorization and paid inference require a user-owned account, explicit consent, and available credits; no provider key is present in the repository.

## How to update this file

- Update the date when status changes materially.
- Keep the active objective to one outcome.
- Move completed items out of “In progress.”
- Record blockers with an owner or the decision needed to unblock them.
- Keep detailed task checklists in `ROADMAP.md`; use this file as a concise project snapshot.
