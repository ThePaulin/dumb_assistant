import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';

import { buildManualItem, defaultManualItemInput, previewNextOccurrence } from './manual-item';

describe('manual item adapter', () => {
  const now = Temporal.Instant.from('2026-10-26T14:00:00Z');

  it('builds a weekday reminder with multiple times', () => {
    const input = defaultManualItemInput(now, 'America/Toronto');
    const result = buildManualItem({
      ...input,
      title: 'Take medication',
      date: '2026-10-27',
      time: '09:00',
      frequency: 'week',
      weekdays: [1, 3, 5],
      timesOfDay: '09:00, 17:00',
      stopKind: 'after_occurrences',
      stopAfterOccurrences: '12',
    }, { id: 'manual-1', revision: 1 });

    expect(result.errors).toEqual([]);
    expect(result.item?.schedule.weekdays).toEqual([1, 3, 5]);
    expect(result.item?.schedule.timesOfDay).toEqual(['09:00:00', '17:00:00']);
    expect(result.item?.schedule.stop).toEqual({ kind: 'after_occurrences', onDate: null, afterOccurrences: 12 });
  });

  it('uses deterministic validation for illegal combinations', () => {
    const input = defaultManualItemInput(now, 'America/Toronto');
    const result = buildManualItem({
      ...input,
      title: 'Invalid event',
      kind: 'event',
      frequency: 'hour',
      recurrenceAnchor: 'fixed',
      useActiveWindow: true,
    }, { id: 'manual-2', revision: 1 });

    expect(result.item).toBeNull();
    expect(result.errors).toContain('Events cannot use active windows.');
  });

  it('previews the next occurrence', () => {
    const input = defaultManualItemInput(now, 'UTC');
    const result = buildManualItem({ ...input, title: 'Call Sam', date: '2026-10-27', time: '15:00' }, { id: 'manual-3', revision: 1 });

    expect(result.item).not.toBeNull();
    expect(previewNextOccurrence(result.item!, now.toString(), 'UTC')?.scheduledLocal).toBe('2026-10-27T15:00:00');
  });
});
