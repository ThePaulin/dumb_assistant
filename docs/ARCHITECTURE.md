# Architecture

This document describes architectural boundaries and constraints. Technology-specific details will be added after the initial choices are evaluated and recorded in the decision log.

## Architectural goals

- Share product code across iOS and Android where practical.
- Keep the scheduling engine deterministic, independently testable, and isolated from AI providers.
- Keep confirmed user data local-first during the MVP.
- Permit transcription and interpretation providers to change without rewriting the domain model.
- Treat operating-system notification APIs as fallible external systems.
- Make schema evolution and data migration explicit from the beginning.

## Proposed logical components

```text
Voice or text input
        |
        v
Transcription adapter (voice only)
        |
        v
Interpretation adapter
        |
        v
Schema validation and clarification
        |
        v
User preview and confirmation
        |
        v
Domain service and local persistence
        |
        +------------------+
        v                  v
Scheduling engine     Query/read models
        |
        v
Notification adapter
        |
        v
iOS / Android notification APIs
```

## Component responsibilities

### Capture

- Manages microphone permission and recording lifecycle.
- Produces an audio artifact or stream for transcription.
- Does not infer reminder semantics.

### Transcription adapter

- Converts audio into text.
- Reports timing and transcription errors separately from interpretation errors.
- Hides provider-specific response formats from the application.

### Interpretation adapter

- Converts text into a versioned structured proposal.
- Identifies missing or uncertain critical fields.
- Never writes directly to storage or notification APIs.

### Validation and clarification

- Applies deterministic schema and business-rule validation.
- Determines whether the proposal can be previewed, needs clarification, or is unsupported.
- Produces user-facing explanations for validation failures.

### Domain and persistence

- Owns reminders, events, occurrences, completion records, and status transitions.
- Persists schedule definitions and schema versions.
- Exposes transactions or equivalent safeguards for schedule mutations.

### Scheduling engine

- Generates occurrences from validated schedule definitions.
- Handles fixed and completion-relative recurrence.
- Has no dependency on UI, transcription, interpretation, or a network service.
- Supports deterministic clock injection for tests.

### Notification adapter

- Reconciles desired occurrences with platform notification registrations.
- Encapsulates platform limits and identifiers.
- Handles notification actions and routes them to domain operations.

## Data and privacy boundaries

- Confirmed reminders, events, and schedule state are stored locally.
- Audio and transcripts are not retained by default beyond the creation flow unless a later decision explicitly changes this.
- Logs should contain request identifiers, timings, result categories, and schema versions—not raw audio, titles, notes, or transcripts.
- Any remote transcription or interpretation must be disclosed before recording begins.
- Secrets and provider keys must never be embedded directly in a shipped mobile application. The final service architecture must account for this before external AI calls are introduced.

## Error boundaries

The app should distinguish at least:

- Microphone or recording failure
- Transcription failure
- Interpretation failure
- Clarification required
- Unsupported schedule
- Validation failure
- Persistence failure
- Notification registration failure
- Notification permission failure

A failure in one layer should not be presented as a generic “AI error” when a more actionable explanation exists.

## Testing strategy

### Unit tests

- Schedule validation
- Occurrence generation
- Date and time-zone behavior
- Status transitions
- Interpretation schema decoding
- Notification reconciliation planning

### Contract tests

- Interpretation provider output against the versioned schema
- Persistence migrations
- Platform notification adapter behavior

### Integration tests

- Create, edit, pause, resume, complete, snooze, and delete flows
- App restart and schedule restoration
- Voice/text proposal through confirmation and persistence

### Physical-device tests

- Notification delivery over multiple days
- Background and terminated application states
- Permission changes
- Device restart where applicable
- Time-zone and clock changes
- Accessibility workflows

## Open technical decisions

These must be resolved through short written decisions rather than becoming implicit through the first implementation:

1. Cross-platform application framework
2. Local database and migration mechanism
3. State-management approach
4. Date/time and recurrence libraries
5. Transcription strategy and provider
6. Interpretation strategy and provider
7. Whether a minimal backend is required to protect AI provider credentials
8. Analytics and crash-reporting tools
9. Test frameworks and physical-device automation
10. Minimum supported iOS and Android versions

## Constraints on early implementation

- Do not make UI components calculate recurrence.
- Do not store recurrence only as human-readable text.
- Do not allow provider-specific AI response objects into the domain layer.
- Do not schedule a notification before deterministic validation and user confirmation.
- Do not assume successful registration guarantees notification delivery.
- Do not commit API keys, signing credentials, or user-generated audio/transcripts.
