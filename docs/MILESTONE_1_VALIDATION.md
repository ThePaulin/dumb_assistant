# Milestone 1 Validation Report

Last updated: 2026-10-26

## Outcome

The end-to-end spike is implemented, statically checked, unit tested, and bundled for iOS and Android. Milestone 1 remains **In progress** because its roadmap explicitly requires physical iOS and Android evidence and measured local/remote behavior. No device or provider measurements in this document are inferred or fabricated.

## Implemented vertical flow

```text
microphone or typed text
  -> cache-scoped audio (voice only)
  -> on-device Whisper Tiny English
  -> local Qwen 2.5 0.5B quantized OR user-authorized OpenRouter
  -> JSON Schema + deterministic semantic validation
  -> confirmation preview
  -> transactional SQLite item/occurrence/registration
  -> OS one-time notification registration
```

The spike deliberately confirms only one-time reminders. Other valid proposal shapes can be previewed but are not scheduled until the deterministic recurrence engine in Milestone 2 exists.

## Implementation evidence

| Area | Evidence | Result |
| --- | --- | --- |
| Application shell | Expo SDK 58, React Native 0.88, Expo Router, New Architecture | Implemented |
| Capture and retention | `expo-audio`; cache recording; success/failure cleanup; startup deletion after 15 minutes | Implemented |
| Local transcription | React Native ExecuTorch Whisper Tiny English; decoded mono 16 kHz PCM | Implemented, device run pending |
| Local interpretation | Quantized Qwen 2.5 0.5B with the committed v1 JSON contract in the prompt | Implemented, corpus/device evaluation pending |
| Model lifecycle | Explicit opt-in download, progress, pause, resume, cancel, unload, delete, and reload controls | Implemented, device run pending |
| Validation | Committed JSON Schema plus deterministic cross-field invariants | 8 proposal/parser tests pass |
| Date/time | Temporal local-to-instant conversion including DST-compatible skipped-time behavior | 3 tests pass |
| Persistence | SQLite WAL, immutable v1 migration, expiring drafts, atomic confirm transaction | Implemented, restart test pending |
| Notifications | Permission/channel setup, stable registration identifier, schedule, retry reconciliation, cancel | Implemented, receipt/action checks pending |
| OpenRouter | S256 PKCE, CSRF state, secure key storage, official copy-code fallback, structured output, local validation | Implemented, account test pending |
| Instrumentation | Local content-free timing/error/model/token/reported-cost rows | Implemented |
| SDK/native configuration | `npx expo-doctor` | 20/20 checks passed |
| Native project generation | Clean iOS and Android `expo prebuild --no-install` in a temporary checkout | Both passed |
| Bundles | `npx expo export --platform ios` and `--platform android` | Both passed |
| Dependency audit | `npm audit --omit=dev` | 5 high findings in Expo CLI/toolchain transitive dependencies; no SDK 58-compatible fix currently offered |

Repository checks on 2026-10-26:

```text
npm run typecheck                     passed
npm test                              11 tests passed
node scripts/validate-milestone-0.mjs passed; 70 corpus cases present
npx expo config --type public         passed
npx expo-doctor                       20/20 checks passed
iOS and Android clean native prebuild passed
iOS and Android Hermes bundle exports passed
```

`npm audit --omit=dev` currently reports Expo's bundled CLI through `node-forge`, `@expo/code-signing-certificates`, and a nested Zod version. The registry's suggested automatic fix downgrades the application to Expo SDK 54 and is not compatible with the selected SDK 58 foundation. The latest published `node-forge` is still the flagged version. These packages are build/signing toolchain dependencies rather than code imported into the application bundle, but the supply-chain finding must be rechecked before beta and upgraded as soon as Expo publishes a compatible resolution.

## Privacy and failure behavior

- Audio is recorded only while the user acts, stored under the application cache, and deleted after transcription or terminal failure. Startup cleanup removes abandoned audio older than 15 minutes.
- Transcript text exists only in the current confirmation draft. Confirmation and cancellation delete the draft; startup cleanup deletes drafts after 24 hours.
- Confirmed records contain distilled reminder fields, not the source transcript.
- Diagnostics exclude audio, transcript, title, notes, location, prompt, raw response, and credential data.
- No notification is requested before deterministic validation and explicit confirmation.
- The SQLite transaction commits the reminder and a pending registration first. OS registration then marks it registered or failed; failed registrations are eligible for launch reconciliation.
- Registration IDs are stable, so retry does not intentionally create a second platform registration.

## OpenRouter behavior

- The default remains on-device. Selecting OpenRouter displays a disclosure before transcript text is sent.
- OAuth uses an S256 verifier/challenge. The deep-link path also checks returned `state`; the official no-callback copy-code flow is available if a provider rejects a native custom scheme.
- The user-controlled API key is stored with `expo-secure-store` and is never persisted in SQLite or logs.
- “Forget key” removes local access. Full revocation opens the hashed-key settings page because OpenRouter's delete-key API requires a management key.
- Requests require a provider endpoint that accepts `response_format: json_schema`; `require_parameters` prevents silent routing to an incompatible endpoint.
- Every remote result is validated locally against the same contract as local inference.
- Reported prompt/completion tokens, model identifier, latency, and response-reported cost are saved without content. Actual latency and cost remain unmeasured until an authorized account test.
- Provider retention and routing depend on the user's OpenRouter account/provider settings and must be checked during the device run.

## Required physical-device matrix

Fill every `Not run` cell with device/OS/build identifiers and attach content-free logs before changing the milestone to Complete.

| Gate | iOS physical device | Android physical device |
| --- | --- | --- |
| Development build installs and starts | Not run | Not run |
| Microphone permission denial/retry | Not run | Not run |
| Record and locally transcribe | Not run | Not run |
| Airplane-mode voice-to-preview | Not run | Not run |
| Confirm and receive one notification | Not run | Not run |
| Open, act on, and cancel notification | Not run | Not run |
| SQLite fixture survives restart/migration | Not run | Not run |
| Download pause/resume/cancel/reload/delete | Not run | Not run |
| Audio cleanup: success/cancel/failure/restart | Not run | Not run |
| Temporal/DST corpus under Hermes | Not run | Not run |
| OpenRouter connect/request/revoke | Not run | Not run |

## Local model qualification matrix

The current models are provisional spike defaults, not a shipped-model decision. Measure Whisper Tiny and Base, and at least three compact language models supported by the runtime, against the same devices and committed 70-case corpus.

| Candidate | Asset size | Peak memory | Median / p95 | Critical-field accuracy | Thermal/battery | Result |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Whisper Tiny English quantized | Not measured | Not measured | Not measured | Transcription WER not measured | Not measured | Pending |
| Whisper Base English quantized | Not measured | Not measured | Not measured | Transcription WER not measured | Not measured | Pending |
| Qwen 2.5 0.5B quantized | Not measured | Not measured | Not measured | Not measured | Not measured | Pending |
| Compact interpretation candidate 2 | Not selected | Not measured | Not measured | Not measured | Not measured | Pending |
| Compact interpretation candidate 3 | Not selected | Not measured | Not measured | Not measured | Not measured | Pending |

For each candidate, record cold download, cold load, warm inference, ten repeated inferences, native/total peak memory, device temperature or thermal state, battery delta, model disposal, and storage reclaimed after deletion. A candidate qualifies only under the gates in `TECH_STACK.md`.

## How to finish the milestone

1. Install development builds with `npm run ios` and `npm run android` on named physical arm64 devices.
2. Complete the device matrix, including an airplane-mode run that starts after both local models are cached.
3. Run the 70-case evaluation for at least three compact interpretation candidates and compare field-level failures.
4. Capture median/p95 end-to-end latency, model asset size, peak memory, ten-run thermal behavior, and battery delta.
5. Connect a user-owned OpenRouter account, set a credit limit, verify structured-output capability and privacy routing, run one request, record latency/cost, and revoke the key.
6. Update this report with actual evidence, check the remaining exit criteria in `ROADMAP.md`, and change `STATUS.md` only when every gate passes.
