# Dumb Assistant

Dumb Assistant is a cross-platform, voice-first productivity app that turns natural speech into dependable reminders and basic events.

The app is designed for people who know what they need to remember but do not want to translate it into a rigid form. A user can speak naturally and verbosely; the app extracts an actionable schedule, asks a focused clarification question when necessary, and presents a structured preview before saving anything.

> **MVP product definition:** A cross-platform, voice-first personal reminder app that converts natural speech into dependable one-time or recurring reminders, asks concise clarification questions when necessary, and always gives the user a clear structured preview before scheduling.

## Project status

**Milestones 0–3 are complete.** The app now includes the validated simulator spike, an AI-independent scheduling engine, and a complete manual product for creating and managing reminders and events. Milestone 4 will turn the existing voice spike into the polished primary creation flow; physical-device reliability qualification remains scheduled for Milestone 6.

See [docs/STATUS.md](docs/STATUS.md) for the current work and [docs/ROADMAP.md](docs/ROADMAP.md) for milestone progress.

## MVP principles

- Voice-first, not voice-only: typed and manual input remain available.
- AI interprets intent; deterministic code validates and schedules it.
- No reminder is silently scheduled from an ambiguous interpretation.
- The user sees a structured preview before saving.
- Reminders are the primary feature; events receive basic support.
- Data is local-first for the MVP, with no account or cloud synchronization.
- Speech transcription and schedule interpretation run on-device by default.
- Users may optionally connect OpenRouter to use a compatible remote model.
- Reliability and user trust are more important than supporting every possible phrase.

## MVP capabilities

- Create one-time reminders through voice, text, or a form.
- Create recurring reminders using intervals, weekdays, multiple daily times, and active-hour windows.
- Stop recurrence on a date, after a number of occurrences, or manually.
- Choose fixed-schedule recurrence or schedule the next occurrence relative to completion.
- Create basic in-app events with start time, optional end time or duration, and alerts.
- Confirm, edit, complete, snooze, pause, resume, reschedule, and delete items.
- Receive local notifications on iOS and Android.
- Review upcoming items and their next occurrence.

## Explicitly outside the MVP

- Accounts and cloud synchronization
- Apple Calendar or Google Calendar synchronization
- Shared reminders, shared calendars, or team workspaces
- Desktop and web clients
- Location-based reminders
- Always-listening voice activation
- Email, messaging, or third-party automation integrations
- Habit streaks and advanced productivity analytics
- Dependencies between tasks
- Arbitrary natural-language scheduling beyond the documented recurrence model

## Example

Spoken input:

> Starting tomorrow, remind me every three hours to drink water, but only between nine and six, and stop after Friday.

Proposed interpretation:

```text
Title: Drink water
Starts: Tomorrow at 9:00 AM
Repeats: Every 3 hours
Active window: 9:00 AM–6:00 PM
Ends: Friday
```

The user can confirm or edit this interpretation before the reminder is scheduled.

## Documentation

- [Product scope](docs/PRODUCT.md) — users, workflows, requirements, boundaries, and success measures
- [Scheduling specification](docs/SCHEDULING_SPEC.md) — recurrence semantics and edge cases
- [Domain model](docs/DOMAIN_MODEL.md) — item, occurrence, notification, and SQLite v1 contracts
- [Architecture](docs/ARCHITECTURE.md) — system boundaries, constraints, and selected technical foundation
- [Technical stack](docs/TECH_STACK.md) — selected technologies, on-device inference, and validation gates
- [UX flows](docs/UX_FLOWS.md) — low-fidelity screen flows and accessibility criteria
- [Roadmap](docs/ROADMAP.md) — milestones, deliverables, and exit criteria
- [Current status](docs/STATUS.md) — active work, risks, and immediate next steps
- [Milestone 1 validation](docs/MILESTONE_1_VALIDATION.md) — implemented spike, evidence, device matrix, and measurement protocol
- [Milestone 2 validation](docs/MILESTONE_2_VALIDATION.md) — deterministic engine, persistence, reconciliation, and automated evidence
- [Milestone 3 validation](docs/MILESTONE_3_VALIDATION.md) — manual product surfaces, accessible workflows, and simulator evidence
- [Decision log](docs/DECISIONS.md) — product and technical decisions with their rationale
- [Contributing](CONTRIBUTING.md) — working agreements and definition of done
- [Interpretation schema](schemas/interpretation-proposal.v1.schema.json) — versioned AI output contract
- [Evaluation corpus](evals/interpretation-cases.v1.json) — 70 phrase-to-structure cases

## Development

The application uses Expo SDK 58, React Native 0.88, strict TypeScript, Expo Router, SQLite, Temporal semantics, and React Native ExecuTorch. ExecuTorch requires the New Architecture and native development builds; Expo Go is not a supported runtime for this spike.

Requirements:

- Node.js 22
- Xcode for iOS or Android Studio/SDK for Android
- A physical arm64 device for milestone validation

Install and run:

```bash
npm install
npm run ios
# or
npm run android
```

The first offline run downloads removable Whisper Tiny English and quantized Qwen 2.5 0.5B model assets. No model binaries or provider credentials are committed. The optional OpenRouter path uses user-authorized OAuth PKCE and device secure storage.

Run the repository checks with:

```bash
npm run check
```

Create a production-like bundle without a device with:

```bash
npx expo export --platform ios
```

## License

No license has been selected yet. Until one is added, the source code is not offered under an open-source license.
