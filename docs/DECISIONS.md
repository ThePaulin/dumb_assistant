# Decision Log

Record decisions that constrain product behavior or implementation. This prevents important choices from being hidden in code, chat history, or assumptions.

Statuses:

- **Proposed** — under discussion
- **Accepted** — current direction
- **Superseded** — replaced by a later decision

## D-001 — Reminders are the MVP's primary feature

- **Status:** Accepted
- **Date:** 2026-10-26

Events receive basic support, but reminder creation, recurrence, delivery, and management receive most of the engineering depth.

**Rationale:** Flexible reminders test the product's distinct value more directly. Full calendar behavior would broaden the product substantially.

## D-002 — The app is voice-first, not voice-only

- **Status:** Accepted
- **Date:** 2026-10-26

Voice is the primary creation experience. Text entry and a complete manual editor remain available.

**Rationale:** Users cannot or will not speak in every environment, and manual editing is necessary for accessibility and trust.

## D-003 — AI proposes; deterministic code schedules

- **Status:** Accepted
- **Date:** 2026-10-26

The interpretation layer produces a structured proposal. Deterministic code validates it, the user confirms it, and only then does the scheduling system persist and activate it.

**Rationale:** Free-form model output is not a reliable scheduling engine. The boundary also makes behavior testable and providers replaceable.

## D-004 — Confirmation is required before activation

- **Status:** Accepted
- **Date:** 2026-10-26

The user sees a structured preview and confirms or edits it before a reminder or event becomes active.

**Rationale:** Incorrect but plausible interpretations are the product's most damaging failure mode.

## D-005 — MVP data is local-first without accounts

- **Status:** Accepted
- **Date:** 2026-10-26

The MVP has no account system or cloud synchronization. Confirmed items and schedule state are stored locally.

**Rationale:** This reduces scope and lets the team validate the central interaction and scheduling reliability first.

**Consequence:** Backup, multi-device continuity, and restoration after device loss are not initially available unless a local export is later added.

## D-006 — External calendar synchronization is deferred

- **Status:** Accepted
- **Date:** 2026-10-26

Basic events live inside Dumb Assistant during the MVP. The app does not initially synchronize with Apple Calendar or Google Calendar.

**Rationale:** Calendar permissions, duplicates, conflict resolution, recurrence parity, and bidirectional updates add substantial scope.

## D-007 — Completion-relative recurrence is included

- **Status:** Accepted
- **Date:** 2026-10-26

Schedules can be fixed to the calendar or calculate the next occurrence from completion time.

**Rationale:** Completion-relative scheduling solves use cases that conventional calendar recurrence handles poorly and supports the app's flexible-reminder positioning.

## D-008 — Use a shared cross-platform codebase

- **Status:** Accepted
- **Date:** 2026-10-26

The iOS and Android apps will use React Native with TypeScript through Expo SDK 58 development builds and Expo Router.

**Selection criteria:**

- Reliable local notification support
- Background and lifecycle behavior
- Audio recording support
- Accessibility
- Date/time and local database ecosystem
- Automated and physical-device testing
- Long-term maintainability

**Rationale:** Expo supplies maintained audio, notification, SQLite, and routing integrations while retaining access to custom native modules through development builds. This keeps the domain and most UI code shared without preventing platform-specific reliability work.

**Consequence:** Physical-device tests remain mandatory because notification delivery and native model performance differ by operating system and hardware.

## D-009 — Inference is on-device by default

- **Status:** Accepted
- **Date:** 2026-10-26

Speech transcription and schedule interpretation run locally through React Native ExecuTorch and downloadable quantized models.

**Rationale:** Local inference matches the local-first product, works offline, avoids mandatory accounts and developer-funded inference, and keeps voice content private by default.

**Consequences:** Users must download model assets, lower-end devices may not meet memory or latency gates, and model selection must be driven by the committed evaluation corpus. Manual creation always remains available.

## D-010 — OpenRouter is the optional remote-model path

- **Status:** Accepted
- **Date:** 2026-10-26

Users may connect their own OpenRouter account using OAuth PKCE and select an endpoint that supports structured outputs. The app has no shared OpenRouter key.

**Rationale:** This offers model choice and a fallback for devices that cannot run the local models while keeping cost and authorization under user control.

**Consequences:** Remote use requires explicit disclosure, network access, secure credential storage, local schema validation, and endpoint capability checks. Provider behavior and privacy may vary.

## D-011 — No mandatory inference backend

- **Status:** Accepted
- **Date:** 2026-10-26

The MVP does not require a project-operated service for speech or language-model inference.

**Rationale:** On-device inference covers the default experience and OpenRouter OAuth PKCE supports user-controlled remote access directly from the app.

**Consequences:** A backend may still be introduced later for sync, abuse-controlled shared inference, or other services, but requires a new decision and is not part of the MVP foundation.

## D-012 — SQLite is authoritative local storage

- **Status:** Accepted
- **Date:** 2026-10-26

Use `expo-sqlite` in WAL mode with repository interfaces and ordered migrations. SQLite owns persistent product state; operating-system notification registrations are derived state.

**Rationale:** The data is relational, transactional, local-first, and must survive restarts and schema upgrades.

**Consequence:** Schedule mutations and occurrence history require explicit migrations and transactional tests.

## D-013 — Temporal semantics and a custom recurrence engine

- **Status:** Accepted
- **Date:** 2026-10-26

Use Temporal concepts through `@js-temporal/polyfill`, subject to a Hermes compatibility spike, and implement recurrence as a pure TypeScript domain package.

**Rationale:** IANA time zones and DST disambiguation must be explicit. Active windows and completion-relative recurrence do not map cleanly to a single general RRULE abstraction.

**Consequence:** The project owns a larger scheduling test surface and must not duplicate recurrence logic in UI code.

## D-014 — Voice source data is ephemeral

- **Status:** Accepted
- **Date:** 2026-10-26

Audio is deleted after local transcription, cancellation, or terminal failure. Transcripts exist only in the draft flow and expire no later than 24 hours. Confirmed items store only distilled content and schedule state.

**Rationale:** Audio and transcripts are more sensitive than the reminder object and are not needed for core product behavior after confirmation.

**Consequence:** Users cannot replay old recordings or recover original transcripts. Evaluation uses synthetic or explicitly consented fixtures, never incidental user recordings.

## D-015 — Time-zone and DST behavior is explicit

- **Status:** Accepted
- **Date:** 2026-10-26

Schedules default to `follow_device` unless the user specifies a fixed IANA zone. Nonexistent DST times move forward by the gap; repeated times use the earlier instant.

**Rationale:** Travel and DST must not produce implicit platform-dependent behavior.

**Consequence:** Time-zone changes trigger occurrence regeneration and notification reconciliation for `follow_device` schedules.

## D-016 — Persistent and transient state remain separate

- **Status:** Accepted
- **Date:** 2026-10-26

SQLite and repository services own persistent state. React component state, `useReducer`, and narrowly scoped contexts own draft and session state. No general global-state library is added initially.

**Rationale:** This avoids competing sources of truth before the application demonstrates a need for another state layer.

**Consequence:** Introducing a state library requires a new decision tied to a concrete limitation.

## Decision template

Copy this section for new decisions:

```markdown
## D-XXX — Decision title

- **Status:** Proposed | Accepted | Superseded by D-XXX
- **Date:** YYYY-MM-DD

Decision statement.

**Rationale:** Why this direction was chosen.

**Consequences:** Important tradeoffs or follow-up work.
```
