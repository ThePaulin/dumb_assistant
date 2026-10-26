# Project Status

Last updated: 2026-10-26

## Current milestone

**Milestone 0 — Complete. Milestone 1 — Complete (simulator-scoped technical spike). Milestone 2 — Not started.**

## Current objective

Begin Milestone 2 by extracting the deterministic scheduling engine from the validated vertical spike.

## Completed

- Defined the MVP promise, reminder/event boundaries, recurrence semantics, retention rules, and 70-case interpretation corpus.
- Selected Expo/React Native, SQLite, Temporal semantics, React Native ExecuTorch, and optional user-authorized OpenRouter.
- Built the Expo SDK 58 development-build application shell with strict TypeScript and Expo Router.
- Implemented cache-scoped microphone capture, cleanup, Whisper transcription, downloadable/removable model controls, and typed fallback.
- Implemented compact local interpretation, canonical schema expansion, semantic validation, and future-time protection.
- Implemented SQLite v1 migration, expiring drafts, transactional confirmation, and retryable notification registration.
- Implemented optional OpenRouter OAuth PKCE, secure storage, copy-code fallback, structured output, and content-free diagnostics.
- Built and ran the native iOS app in an iPhone 17 Pro / iOS 26.3 simulator.
- Verified model download/reload, permission denial/retry, local interpretation, preview, confirmation, notification registration, persistence, and restart recovery.
- Compared three compact language-model candidates and provisionally selected Qwen 3 0.6B for the spike.
- Recorded simulator evidence and the deferred physical-device qualification in `MILESTONE_1_VALIDATION.md`.

## Next up

1. Implement pure deterministic occurrence generation for the supported one-time and recurring schedules.
2. Add edit, pause, resume, complete, snooze, reschedule, and delete operations with notification reconciliation.
3. Expand restart, migration, time-zone, and daylight-saving tests.
4. Preserve the physical iOS/Android, notification-delivery, speech-quality, resource, and OpenRouter account checks for Milestone 6/private beta.

## Current risks

| Risk | Impact | Current mitigation |
| --- | --- | --- |
| Plausible but incorrect AI interpretation | Users lose trust or miss commitments | Confirmation preview, compact protocol, canonical schema, semantic and future-time validation |
| Mobile notification restrictions | Reminders may not be delivered as registered | Stable identifiers, reconciliation, deferred physical multi-day reliability testing |
| Compact local model misses critical fields | Incorrect reminders or loss of trust | Provisional model only; 70-case corpus and release accuracy gates remain |
| Model download or memory pressure excludes older devices | Voice intelligence may be unavailable | Removable downloads, typed/manual path, optional OpenRouter, deferred hardware benchmarks |
| User-authorized remote key is exposed | User-funded inference could be abused | OAuth PKCE, secure storage, credit-limit guidance, disconnect/revoke flow |
| Privacy concerns around voice | Users may avoid the primary interaction | Minimal retention, explicit remote disclosure, content-free diagnostics |

## Deferred validation, not blockers

- No paid Apple Developer membership is available, so this milestone used an iOS simulator instead of a signed physical-device build.
- Physical iOS/Android microphone quality, notification delivery/actions, memory, battery, thermal, and multi-day reliability remain required before beta.
- OpenRouter authorization and paid inference require a user-owned account, explicit consent, and available credits; no provider key is present in the repository.

## How to update this file

- Update the date when status changes materially.
- Keep the active objective to one outcome.
- Record deferred evidence explicitly rather than inferring it from implementation.
- Keep detailed task checklists in `ROADMAP.md`; use this file as a concise project snapshot.
