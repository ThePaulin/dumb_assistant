# Project Status

Last updated: 2026-10-26

## Current milestone

**Milestones 0–2 — Complete. Milestone 3 — Not started.**

## Current objective

Build the usable manual product on top of the deterministic scheduling engine.

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
- Implemented an AI-independent scheduling domain with deterministic occurrence identities and strict combination validation.
- Implemented one-time, interval, weekday, multi-time, active-window, fixed, and completion-relative recurrence.
- Implemented inclusive end-date/count/manual-stop behavior, monthly clamping, relative-date resolution, and explicit DST/time-zone policies.
- Added transactional SQLite schedule creation, materialization, edit, pause, resume, stop, complete, snooze, reschedule, and hard-delete operations.
- Replaced append-only notification retry with capped, idempotent reconciliation that cancels obsolete platform registrations.
- Added schedule, transition, reconciliation, and executable SQLite migration tests; the full repository check passes 76 tests.
- Recorded Milestone 2 scope and evidence in `MILESTONE_2_VALIDATION.md`.

## Next up

1. Build the Today/upcoming and item-detail read models and screens.
2. Add manual creation/editing, recurrence controls, and occurrence actions over the Milestone 2 repository APIs.
3. Add permission onboarding plus empty, loading, error, paused, ended, and completed states.
4. Preserve physical notification-delivery and multi-day reliability qualification for Milestone 6/private beta.

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
