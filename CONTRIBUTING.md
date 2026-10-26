# Contributing

This project is in its specification and foundation stage. Contributions should keep product behavior explicit and preserve the boundary between probabilistic interpretation and deterministic scheduling.

## Before starting work

1. Read `README.md` and the relevant documents under `docs/`.
2. Check `docs/STATUS.md` for the active objective.
3. Check `docs/ROADMAP.md` for the relevant milestone and exit criteria.
4. Record a product or architectural decision in `docs/DECISIONS.md` when the change introduces a lasting constraint.
5. Do not silently expand the MVP scope.

For specification changes, run:

```bash
node scripts/validate-milestone-0.mjs
```

## Branches and commits

- Create a focused branch for each feature, fix, or documentation change.
- Keep commits small enough to review and test independently.
- Use imperative commit subjects, for example: `Add weekday recurrence validation`.
- Separate mechanical formatting from behavioral changes where practical.

## Pull requests

A pull request should explain:

- The user or engineering problem
- The chosen approach
- Product or architecture decisions introduced
- Tests performed
- Known limitations or follow-up work

Use the repository pull-request template as a final check.

## Definition of done

A change is complete when applicable items below are satisfied:

- Behavior matches the product and scheduling specifications.
- Automated tests cover success, failure, and boundary cases.
- Mobile behavior has been checked on the relevant platform or device.
- Accessibility labels, focus, touch targets, and dynamic text are considered.
- Errors are actionable and do not expose private user content.
- Persistence and schema changes include migration handling.
- Notification changes include reconciliation behavior.
- Documentation and milestone status are updated.
- No credentials, user audio, transcripts, or sensitive logs are committed.

## Scheduling changes

Any change to recurrence, snooze, completion, pause/resume, time zones, or occurrence counting must:

1. Update `docs/SCHEDULING_SPEC.md`.
2. Add representative examples.
3. Add deterministic automated tests.
4. Consider existing persisted schedules and migrations.
5. Consider notification registrations already present on the device.

## Interpretation changes

Any change to prompts, models, providers, extraction logic, or interpretation schemas must:

1. Preserve a version identifier.
2. Be evaluated against the representative phrase corpus.
3. Report field-level regressions, especially date, time, recurrence, and stopping rules.
4. Prefer clarification or an unsupported result over an invented critical value.
5. Record local model size, quantization, runtime, device, peak memory, latency, and thermal behavior.
6. Preserve the on-device default and require explicit consent before remote interpretation.

## Documentation ownership

- `README.md` explains the project to a new contributor.
- `docs/PRODUCT.md` is the source of truth for MVP behavior and boundaries.
- `docs/SCHEDULING_SPEC.md` is the source of truth for scheduling semantics.
- `docs/ARCHITECTURE.md` describes system boundaries and constraints.
- `docs/DECISIONS.md` records why lasting choices were made.
- `docs/ROADMAP.md` tracks milestone completion.
- `docs/STATUS.md` is the concise, current project snapshot.
