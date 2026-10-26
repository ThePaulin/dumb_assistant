# Technical Stack Decision

Decision date: 2026-10-26

This stack is selected for the MVP and will be validated by the Milestone 1 vertical spike. A failed physical-device exit criterion can trigger a documented replacement decision.

## Selected mobile stack

| Area | Choice |
| --- | --- |
| Language | TypeScript with strict compiler settings |
| Mobile framework | React Native through Expo SDK 58 development builds |
| Navigation | Expo Router |
| Audio capture | Foreground 16 kHz PCM capture compatible with React Native ExecuTorch; validate `expo-audio` AudioStream first |
| Local notifications | `expo-notifications` |
| Persistence | `expo-sqlite`, WAL mode, repository layer, versioned migrations |
| Domain validation | Zod plus explicit domain validators |
| Date/time | Temporal semantics using `@js-temporal/polyfill`, verified on Hermes during the spike |
| Recurrence | Custom pure TypeScript engine; no general RRULE dependency |
| On-device inference | React Native ExecuTorch with downloadable, quantized speech and compact language models |
| Persistent state | SQLite is authoritative |
| UI/session state | Component state and `useReducer`; narrowly scoped React contexts for app services |
| Tests | Vitest for pure TypeScript; React Native Testing Library for UI; Maestro for critical device flows |
| Package/runtime baseline | Node.js 22.13+ and the package manager chosen when scaffolding |
| Supported OS baseline | Android 7+ and iOS 16.4+, matching Expo SDK 58 |

Use an Expo development build from the beginning rather than relying on Expo Go as the production development environment.

## Why Expo/React Native

The MVP needs cross-platform UI, audio recording, SQLite, notification scheduling, native permission flows, and physical-device testing. Expo provides maintained modules for all four native boundaries while preserving access to native modules when required.

Alternatives considered:

| Option | Strengths | Reason not selected |
| --- | --- | --- |
| Expo + React Native | Shared TypeScript, maintained audio/SQLite/notification modules, development builds, rapid device iteration | Selected; native edge cases still require device testing |
| React Native without a framework | Maximum native-project control | Adds native configuration and upgrade work before it provides MVP value |
| Flutter | Strong cross-platform rendering and tooling | Introduces a second language/runtime while still depending on plugins for the same notification and audio boundaries |
| Separate Swift/Kotlin apps | Maximum platform control and fidelity | Doubles feature work and undermines the shared-code MVP constraint |

Primary evidence:

- [Expo Router introduction](https://docs.expo.dev/router/introduction/) documents the recommended file-based framework for new Expo apps and shared Android/iOS routes.
- [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) provides cross-platform recording, streaming, and permission APIs.
- [Expo Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) supports scheduling and responding to local notifications.
- [Expo SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) persists SQLite databases across restarts.
- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) establishes its React Native, Node.js, Android, and iOS baselines.

## Date/time and recurrence

The scheduling engine uses Temporal concepts: `Instant` for exact points, `PlainDateTime` for user-authored wall time, and `ZonedDateTime` for resolving wall time in an IANA zone. The Temporal `compatible` rule supplies the chosen DST behavior.

The recurrence engine remains custom because active windows and completion-relative schedules do not map cleanly to a single calendar RRULE. It will be a pure package with an injected clock and no React Native dependencies.

Evidence: [Temporal ZonedDateTime documentation](https://tc39.es/proposal-temporal/docs/zoneddatetime.html) describes time-zone-aware arithmetic and explicit disambiguation for nonexistent or repeated local times.

## AI architecture: on-device first

Transcription and interpretation run on the device by default. The MVP does not require an inference backend or developer-funded API key.

### Local transcription

- Use React Native ExecuTorch's Whisper speech-to-text pipeline.
- Start the spike with multilingual Whisper Tiny and compare Tiny versus Base using representative accents, background noise, names, dates, and numbers.
- Download model assets after an explicit user action, display size and progress, support cancellation/resume, and allow deletion in settings.
- Keep recording and inference in the foreground for the MVP.
- Dispose native model and tensor resources explicitly when they are no longer needed.

[React Native ExecuTorch's speech-to-text documentation](https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text) supports live PCM and pre-recorded transcription with downloadable Whisper Tiny, Base, and Small models across iOS and Android.

### Local interpretation

- Use React Native ExecuTorch for compact instruction-model inference.
- Begin evaluation with Hammer 2.1 0.5B because it is tuned for function calling/structured JSON, and compare it with LFM 2.5 350M and one sub-1B multilingual alternative.
- Use temperature `0`, a short fixed prompt, the reference time/locale/zone, and the versioned schema.
- Parse and validate locally with Zod. Model output never bypasses deterministic domain validation.
- Permit one constrained retry for invalid JSON; after that, show an interpretation failure and offer manual editing or OpenRouter.

The current [React Native ExecuTorch LLM catalog](https://docs.swmansion.com/react-native-executorch/docs/extensions/llm-chat-and-generation) includes compact models from roughly 265 MB upward and notes their supported device backends. Its [benchmark guidance](https://docs.swmansion.com/react-native-executorch/docs/next/benchmarks) shows why download size, peak native memory, cold start, and device-specific throughput must be release gates rather than assumptions.

The exact shipped weights are deliberately selected in Milestone 1 from measured results, not brand preference. A model qualifies only if it meets all of these gates on the baseline physical-device set:

- 100% schema-valid output after at most one retry
- At least 80% exact full-case accuracy on ordinary supported phrases
- At least 95% accuracy for intent, date, time, recurrence, anchor, and stop-rule fields
- Median interpretation latency at or below 2 seconds and p95 at or below 5 seconds
- Peak additional resident memory at or below 1.5 GB
- Combined speech and language model download at or below 750 MB
- No crash, OS memory termination, or serious thermal warning during 20 sequential captures

If no tested model meets the critical-field gate, the app remains manual-first on that device and recommends the optional remote path rather than shipping unreliable local interpretation.

### Optional OpenRouter path

Users may connect OpenRouter with OAuth PKCE and select a compatible remote model. The generated user-controlled key is stored in the platform secure credential store and can be disconnected/deleted at any time.

- Remote inference is opt-in and clearly indicates that transcript text leaves the device.
- The app sends transcript text, reference context, and the proposal schema—never raw audio for MVP interpretation.
- Model selection is restricted to endpoints advertising structured-output support for schedule creation.
- Requests set `require_parameters: true` and include strict `json_schema` response format.
- Responses still pass the same local schema and domain validation as on-device output.
- Users are prompted to set an OpenRouter credit limit and can inspect or revoke their key.
- A remote failure falls back to local/manual behavior; it never blocks access to saved schedules.

OpenRouter documents [OAuth PKCE for user-controlled API keys](https://openrouter.ai/docs/guides/overview/auth/oauth) and [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). Structured-output support is endpoint-specific and enforcement can vary, which is why local validation remains mandatory.

### Provider-neutral interface

```text
TranscriptionEngine
  prepare()
  transcribe(audioStream): Transcript
  dispose()

InterpretationEngine
  prepare()
  interpret(text, context, schemaVersion): InterpretationProposal
  dispose()

Implementations
  LocalWhisperTranscriptionEngine
  LocalCompactInterpretationEngine
  OpenRouterInterpretationEngine
```

This boundary permits future system-model or cloud integrations without changing scheduling code.

## Data retention

- The mobile recorder keeps PCM/audio only in memory or an application cache location.
- Audio is deleted immediately after local transcription, cancellation, or a terminal failure. A startup cleanup deletes abandoned audio older than 15 minutes.
- The transcript exists only in the confirmation draft and is deleted on confirm, cancel, or 24-hour draft expiry.
- Confirmed items store the distilled title, notes, schedule, and domain history—not the source transcript.
- Product logs exclude audio, transcripts, reminder titles, notes, and locations.
- Opt-in diagnostic export is deferred until its redaction rules are designed.
- When OpenRouter is used, only transcript text and interpretation context are sent remotely after explicit disclosure. Provider-routing and retention behavior must be disclosed and verified before beta.

## State-management rule

Do not add a general global-state library during the spike. SQLite owns persistent state, repositories expose domain operations, and React owns transient screen state. Introduce another state library only through a decision showing a concrete problem that React context/reducers and query hooks cannot solve.

## Milestone 1 validation gates

- Record and transcribe locally on physical iOS and Android devices.
- Download, resume, delete, reload, and dispose both model assets safely.
- Schedule, receive, act on, and cancel a local notification on both platforms.
- Persist and migrate a SQLite fixture across an app restart.
- Run the Temporal polyfill and DST test corpus under Hermes.
- Evaluate at least three compact interpretation models against the committed phrase corpus.
- Validate both local and OpenRouter outputs against the same committed schema.
- Measure end-to-end median/p95 latency, peak memory, model size, and repeated-use thermal behavior.
- Confirm audio cleanup on success, cancellation, failure, and application restart.
- Confirm OpenRouter OAuth PKCE, secure credential storage, revocation, and credit-limit guidance.
