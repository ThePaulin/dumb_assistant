# Architecture

This document describes the MVP architecture and its boundaries. Selected technologies and validation gates are detailed in `TECH_STACK.md` and recorded in the decision log.

## Architectural goals

- Share product code across iOS and Android where practical.
- Keep the scheduling engine deterministic, independently testable, and isolated from AI providers.
- Keep confirmed user data local-first during the MVP.
- Run transcription and interpretation locally by default while permitting optional engines without rewriting the domain model.
- Treat operating-system notification APIs as fallible external systems.
- Make schema evolution and data migration explicit from the beginning.

## Proposed logical components

```text
Voice input --------> Local Whisper engine
   |                         |
   |                         v
Text input ------------> Transcript text
                              |
                              v
              +------- Interpretation engine -------+
              |                                      |
              v                                      v
       Local compact model                 OpenRouter (optional)
              |                                      |
              +------------------+-------------------+
                                 |
                                 v
                      Provider-neutral proposal
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
- Uses local Whisper through React Native ExecuTorch for the MVP.
- Reports model availability, memory, timing, and transcription errors separately from interpretation errors.
- Owns model download, load, disposal, and version metadata.

### Interpretation adapter

- Converts text into a versioned structured proposal.
- Identifies missing or uncertain critical fields.
- Never writes directly to storage or notification APIs.
- Uses a compact local model by default and an OAuth-authorized OpenRouter model only when the user opts in.
- Normalizes both engines to the same committed proposal schema.

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
- Audio is deleted after transcription, cancellation, or terminal failure; abandoned cache entries are deleted after 15 minutes.
- Transcripts exist only in interpretation drafts and are deleted on confirm, cancel, or 24-hour draft expiry.
- Local model assets are separate from user data and can be deleted in settings.
- OpenRouter receives transcript text only after explicit opt-in; raw audio is not sent through that path.
- A user-controlled OpenRouter key is created through OAuth PKCE, stored in the platform secure credential store, and revocable.
- Logs should contain request identifiers, timings, result categories, and schema versions—not raw audio, titles, notes, or transcripts.
- Remote interpretation and its provider/model are disclosed before transcript text leaves the device.
- No developer-owned provider key is embedded in the application.

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

- Local and optional remote interpretation output against the versioned schema
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
- Model download, cold load, memory pressure, disposal, latency, and thermal behavior
- Local inference with the network disabled
- OpenRouter OAuth callback, secure storage, disconnect, and revocation

## Selected technical foundation

| Concern | Selection |
| --- | --- |
| Application | Expo SDK 58, React Native, TypeScript, Expo Router, development builds |
| Storage | `expo-sqlite`, WAL, repository interfaces, ordered migrations |
| Date/time | Temporal semantics through `@js-temporal/polyfill` |
| Recurrence | Pure TypeScript custom engine |
| Local inference | React Native ExecuTorch with downloadable Whisper and compact instruction models |
| Optional remote inference | OpenRouter OAuth PKCE and structured-output-compatible endpoints |
| Validation | JSON Schema contract plus Zod/domain validation |
| State | SQLite for persistent state; React state/reducers/contexts for transient state |

Milestone 1 determines the exact compact model weights and Whisper size by measurement. Analytics/crash-reporting vendors are intentionally deferred until reliability hardening; early diagnostics remain local and content-free.

## Constraints on early implementation

- Do not make UI components calculate recurrence.
- Do not store recurrence only as human-readable text.
- Do not allow provider-specific AI response objects into the domain layer.
- Do not schedule a notification before deterministic validation and user confirmation.
- Do not assume successful registration guarantees notification delivery.
- Do not commit API keys, signing credentials, model binaries, or user-generated audio/transcripts.
- Do not load a local model without handling download progress, memory failure, cancellation, and explicit native-resource disposal.
- Do not send transcript text remotely unless the user selected the OpenRouter path and saw the disclosure.
