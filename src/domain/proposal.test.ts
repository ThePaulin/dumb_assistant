import { describe, expect, it } from 'vitest';

import { extractJsonObject, validateProposal, type InterpretationProposal } from './proposal';

function validProposal(): InterpretationProposal {
  return {
    schema_version: '1.0.0',
    result: 'proposal',
    intent: 'reminder',
    title: 'Call Sam',
    notes: null,
    schedule: {
      start_local: '2026-10-27T15:00:00',
      time_zone: 'America/Toronto',
      time_zone_policy: 'follow_device',
      frequency: 'none',
      interval: null,
      weekdays: [],
      times_of_day: [],
      active_window: null,
      recurrence_anchor: 'fixed',
      stop: { kind: 'never', on_date: null, after_occurrences: null },
    },
    event: null,
    clarification: null,
    unsupported: null,
    warnings: [],
    field_confidences: [
      { field: 'start_time', confidence: 'high', source_text: 'tomorrow at 3 PM' },
    ],
  };
}

describe('validateProposal', () => {
  it('accepts a complete one-time reminder', () => {
    const result = validateProposal(validProposal());
    expect(result.ok).toBe(true);
  });

  it('rejects a schema-invalid model response', () => {
    const malformed = { ...validProposal(), schema_version: '2.0.0', invented: true };
    const result = validateProposal(malformed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/additional properties|schema_version/i);
  });

  it('rejects a proposal with no usable title', () => {
    const result = validateProposal({ ...validProposal(), title: '   ' });
    expect(result).toEqual({ ok: false, errors: ['A proposal must have a non-empty title.'] });
  });

  it('rejects recurrence fields hidden in a one-time schedule', () => {
    const proposal = validProposal();
    proposal.schedule!.times_of_day = ['15:00:00'];
    const result = validateProposal(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('A one-time schedule cannot contain recurrence fields.');
  });

  it('rejects an overnight active window', () => {
    const proposal = validProposal();
    proposal.schedule = {
      ...proposal.schedule!,
      frequency: 'hour',
      interval: 2,
      active_window: { start_time: '22:00:00', end_time: '06:00:00' },
    };
    const result = validateProposal(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('Overnight active windows are unsupported.');
  });

  it('does not allow event details on a reminder', () => {
    const result = validateProposal({
      ...validProposal(),
      event: {
        end_local: null,
        duration_minutes: 30,
        location: null,
        alert_offsets_minutes: [],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('Only an event may contain event details.');
  });
});

describe('extractJsonObject', () => {
  it('extracts JSON from a fenced local-model response', () => {
    expect(extractJsonObject('answer:\n```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('rejects output without an object', () => {
    expect(() => extractJsonObject('not json')).toThrow('did not return a JSON object');
  });
});
