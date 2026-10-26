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

- **Status:** Accepted in principle; implementation pending
- **Date:** 2026-10-26

The iOS and Android apps should share the majority of product and domain code. The specific framework has not been selected.

**Selection criteria:**

- Reliable local notification support
- Background and lifecycle behavior
- Audio recording support
- Accessibility
- Date/time and local database ecosystem
- Automated and physical-device testing
- Long-term maintainability

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
