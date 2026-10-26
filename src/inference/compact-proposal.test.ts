import { describe, expect, it } from 'vitest';

import { parseLocalInterpretation } from './compact-proposal';

const context = {
  now: '2026-10-26T18:00:00.000Z',
  timeZone: 'America/Toronto',
  locale: 'en-CA',
};

describe('parseLocalInterpretation', () => {
  it('expands the fixed-field protocol used by the small local model', () => {
    const value = parseLocalInterpretation(
      'P|reminder|Verify simulator validation|2026-10-27T09:00:00|none|0|||0',
      context,
    );

    expect(value.result).toBe('proposal');
    expect(value.schedule?.interval).toBeNull();
    expect(value.schedule?.weekdays).toEqual([]);
  });

  it('normalizes harmless small-model sentinel variations', () => {
    const value = parseLocalInterpretation(
      'P|reminder|Verify validation|2026-10-28T09:00:00|none|none|0|0|',
      context,
    );

    expect(value.schedule?.interval).toBeNull();
    expect(value.schedule?.weekdays).toEqual([]);
    expect(value.schedule?.times_of_day).toEqual([]);
  });

  it('expands a compact one-time reminder into the canonical contract', () => {
    const value = parseLocalInterpretation(JSON.stringify({
      result: 'proposal',
      intent: 'reminder',
      title: 'Verify simulator validation',
      start_local: '2026-10-27T09:00:00',
      frequency: 'none',
      interval: null,
      weekdays: [],
      times_of_day: [],
      duration_minutes: null,
    }), context);

    expect(value.schedule?.time_zone).toBe('America/Toronto');
    expect(value.schedule?.stop).toEqual({ kind: 'never', on_date: null, after_occurrences: null });
    expect(value.title).toBe('Verify simulator validation');
  });

  it('expands a clarification without inventing a schedule', () => {
    const value = parseLocalInterpretation(
      '{"result":"needs_clarification","field":"start_time","question":"What time?"}',
      context,
    );

    expect(value.result).toBe('needs_clarification');
    expect(value.schedule).toBeNull();
  });

  it('rejects incomplete output instead of silently defaulting critical fields', () => {
    expect(() => parseLocalInterpretation(
      '{"result":"proposal","intent":"reminder","title":"Call Sam","frequency":"none"}',
      context,
    )).toThrow('start time');
  });

  it('rejects a plausible but already-past local schedule', () => {
    expect(() => parseLocalInterpretation(
      'P|reminder|Late result|2026-10-26T13:59:00|none|0|||0',
      context,
    )).toThrow('not in the future');
  });
});
