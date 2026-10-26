# Interpretation Evaluation Corpus

`interpretation-cases.v1.json` is the Milestone 0 baseline for measuring transcription-to-schedule interpretation.

## Reference context

Unless a case overrides it:

- Reference time: Monday, 2026-10-26 at 10:00 AM
- Time zone: `America/Toronto`
- Locale: `en-CA`
- Week starts Monday

This fixed context makes relative phrases reproducible.

## Assertion semantics

Each `expected` object is a structured field-level assertion. The evaluator compares every listed field and ignores unlisted descriptive fields such as confidence source spans. Proposal schedules inherit these defaults unless overridden:

```json
{
  "time_zone": "America/Toronto",
  "time_zone_policy": "follow_device",
  "recurrence_anchor": "fixed",
  "stop": { "kind": "never", "on_date": null, "after_occurrences": null },
  "weekdays": [],
  "times_of_day": [],
  "active_window": null
}
```

For `proposal` cases, all listed schedule fields are required to match. For clarification cases, both the missing field and question intent must match; exact question wording may vary. For unsupported cases, the reason code must match.

## Quality tiers

- **Critical:** result, intent, start, time zone policy, recurrence, anchor, stop rule, event duration, and alert offsets.
- **Important:** title and notes.
- **Diagnostic:** warnings, confidence labels, and source spans.

A title difference can be reviewed semantically. Any critical-field difference is a failed case.

## Corpus maintenance

- Never rewrite an existing case merely to make a new model pass.
- Correct a case only when the product specification changes or the fixture was objectively wrong.
- Add regression cases for every production interpretation failure.
- Add audio fixtures separately; do not commit recordings containing real user content.
- Record model, quantization, runtime, device, prompt, schema, latency, and memory alongside every evaluation run.
