# Milestone 1 Validation Report

Last updated: 2026-10-26

## Outcome

Milestone 1 is **Complete under the simulator-scoped exit criteria approved on 2026-10-26**. A native development build installed and ran in an iPhone 17 Pro simulator on iOS 26.3. The test exercised local model download and reload, permission failure and retry, the speech and interpretation pipelines, deterministic validation, confirmation, SQLite persistence, notification registration, and restart recovery.

This result validates the vertical architecture; it is not a physical-device qualification. Real microphone accuracy, actual notification delivery and actions, Android behavior, native peak memory, battery, thermal behavior, and multi-day reliability are explicitly deferred to Milestone 6 and private-beta testing.

## Validated vertical flow

```text
microphone or typed text
  -> cache-scoped audio (voice only)
  -> on-device Whisper Tiny English (XNNPACK)
  -> local Qwen 3 0.6B quantized OR user-authorized OpenRouter
  -> compact local protocol expanded to canonical JSON
  -> JSON Schema + deterministic semantic/future-time validation
  -> confirmation preview
  -> transactional SQLite item/occurrence/registration
  -> OS one-time notification registration
```

The spike confirms only one-time reminders. Other valid proposal shapes can be previewed but are not scheduled until the deterministic recurrence engine in Milestone 2 exists.

## Simulator evidence

| Gate | Evidence | Result |
| --- | --- | --- |
| Native development build | Xcode build completed with 0 errors; app installed and launched as `com.thepaulin.dumbassistant` | Passed |
| Runtime | iPhone 17 Pro simulator, iOS 26.3 | Recorded |
| Microphone permission | Denial surfaced an actionable error; granting permission allowed recording | Passed |
| Local speech path | XNNPACK Whisper Tiny accepted normalized mono 16 kHz/30-second input; two completed transcriptions took 1.63 s and 1.72 s | Pipeline passed; acoustic accuracy not qualified |
| Local interpretation | Qwen 3 0.6B produced a valid exact-date reminder in 2.77 s; compact output was expanded and validated locally | Passed for spike phrase |
| Safety boundary | Malformed, semantically invalid, and already-past output is rejected before preview/persistence | Passed in app and unit tests |
| Confirmation | `Verify simulator validation` for 2026-11-15 09:00 America/Toronto was previewed and explicitly confirmed | Passed |
| Notification registration | Platform identifier was stored with state `registered`; desired instant is 2026-11-15T14:00:00Z | Passed |
| Persistence | Item, occurrence, and registration survived process termination and relaunch | Passed |
| Model lifecycle | Cold download reached ready state and cached assets reloaded after restart | Passed for download/reload |
| Notification receipt/action | The test reminder is future-dated, so delivery and action handling were not claimed | Deferred |
| OpenRouter | Integration and local validation are implemented; no user-owned account/key was authorized | Deferred by account boundary |

The simulator recording path can hear host/simulator noise and produced a plausible Whisper hallucination during a nominally silent capture. The downstream interpreter did not create a schedulable reminder from it. This confirms the safety boundary, but it does not qualify speech recognition; representative spoken audio must be tested on hardware.

## Persistence evidence

The simulator database reported `PRAGMA user_version = 1` and contained:

- an active scheduled item with local start `2026-11-15T09:00:00` in `America/Toronto`;
- one scheduled occurrence at `2026-11-15T14:00:00.000Z`;
- one notification registration in `registered` state with a platform identifier;
- content-free diagnostic rows for interpretation, transcription, and notification registration.

No diagnostic row stores audio, transcript, prompt, response, reminder title, notes, location, or credentials.

## Local model comparison

These are simulator observations from a technical spike, not corpus-quality or physical-resource benchmarks.

| Candidate | Cached asset size | Observed behavior | Observed latency | Decision |
| --- | ---: | --- | ---: | --- |
| Qwen 2.5 0.5B quantized | about 400 MB | Malformed output and an incorrect relative date survived syntax but was caught during review | about 1.1-1.7 s | Rejected |
| Hammer 2.1 0.5B quantized | about 400 MB | Invalid structured fields and repetitive generation | about 45.1 s failure | Rejected |
| Qwen 3 0.6B quantized | about 496 MB model + 12 MB tokenizer | Produced the correct exact-date spike proposal with compact prompting | 2.23-2.77 s successes; one 19.9 s failure | Provisionally selected |
| Whisper Tiny English XNNPACK | about 224 MB model + 2.7 MB tokenizer | Completed simulator transcription; host/silent capture is not an accuracy sample | 1.63-1.72 s | Selected for simulator compatibility |
| Whisper Tiny English Core ML | about 80 MB | Encoder execution failed in this simulator runtime | 0.17-0.60 s failures | Not used in simulator |

The selected fresh-install local assets are approximately 735 MB combined. Failed candidate assets remained in this disposable development simulator and explain its larger current cache. Model deletion and storage reclamation were not exercised because that would destroy the retained validation state.

## Automated and build evidence

Final branch results:

```text
npm run check                          passed: strict typecheck, 20 unit tests, 70-case validator
npx expo-doctor                        passed: 20/20 checks
npx expo export --platform ios         passed: production iOS Hermes bundle
npm audit --omit=dev                    5 high findings in Expo CLI/tooling transitives
```

The unit suite covers canonical proposal validation, date/time behavior, compact local-output expansion, future-time rejection, and Whisper input normalization/silence detection.

The npm findings are in Expo's bundled CLI chain through `node-forge`, `@expo/code-signing-certificates`, and a nested Zod version. The offered automatic fix would downgrade the application to Expo SDK 54, so it was not applied to this SDK 58 project. Recheck and upgrade when Expo publishes a compatible resolution; these findings do not justify silently taking a breaking framework downgrade.

## Privacy and failure behavior

- Audio is recorded only while the user acts, stored under the application cache, and deleted after transcription or terminal failure. Startup cleanup removes abandoned audio older than 15 minutes.
- Transcript text exists only in the current confirmation draft. Confirmation and cancellation delete the draft; startup cleanup deletes drafts after 24 hours.
- Confirmed records contain distilled reminder fields, not the source transcript.
- No notification is requested before deterministic validation and explicit confirmation.
- The SQLite transaction creates the reminder and a pending registration first. OS registration then marks it registered or failed; failed registrations are eligible for launch reconciliation.
- Stable registration identifiers make reconciliation idempotent.

## Deferred hardware qualification

Milestone 6 and private beta must cover:

- physical iOS and Android installation, real speech, denial/retry, backgrounding, and offline behavior;
- notification receipt, open/action/cancel behavior, restart recovery, and multi-day duplicate/loss testing;
- Whisper Tiny/Base accuracy on representative voices, noise, names, dates, and numbers;
- the full interpretation corpus with field-level accuracy and repeated inference;
- native peak memory, storage reclamation after model deletion, battery delta, and thermal state;
- OpenRouter OAuth, structured-output endpoint behavior, privacy routing, latency/cost, and key revocation with a user-authorized account.

The release-quality thresholds in `TECH_STACK.md` remain unchanged; completing this simulator spike does not waive them.
