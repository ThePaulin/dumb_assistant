import { describe, expect, it } from 'vitest';

import type { ScheduledItemDefinition } from '../domain/schedule';
import { displayStatus, scheduleSummary } from './schedule-presentation';

const item: ScheduledItemDefinition = {
  id: 'item', revision: 1, kind: 'reminder', status: 'active', title: 'Water', notes: null,
  schedule: {
    startLocal: '2026-10-26T09:00:00', timeZone: 'America/Toronto', timeZonePolicy: 'follow_device',
    frequency: 'hour', interval: 3, preferredDayOfMonth: null, weekdays: [], timesOfDay: [],
    activeWindow: { startTime: '09:00:00', endTime: '18:00:00' }, recurrenceAnchor: 'fixed',
    stop: { kind: 'on_date', onDate: '2026-10-30', afterOccurrences: null },
  },
  event: null,
};

describe('schedule presentation', () => {
  it('produces a linear accessible recurrence summary', () => {
    expect(scheduleSummary(item)).toBe('Every 3 hours · 09:00–18:00 · through 2026-10-30');
  });

  it('distinguishes a completed one-time item from a manually ended item', () => {
    const ended = { ...item, status: 'ended' as const, schedule: { ...item.schedule, frequency: 'none' as const, interval: null, activeWindow: null, stop: { kind: 'never' as const, onDate: null, afterOccurrences: null } } };
    expect(displayStatus(ended, [{
      id: 'occ', itemId: 'item', itemRevision: 1, sequenceNumber: 1,
      originalScheduledAtUtc: '2026-10-26T13:00:00.000Z', scheduledAtUtc: '2026-10-26T13:00:00.000Z',
      scheduledLocal: '2026-10-26T09:00:00', effectiveTimeZone: 'America/Toronto', dstAdjusted: false,
      status: 'completed', snoozedUntilUtc: null, completedAtUtc: '2026-10-26T13:05:00.000Z', missedAtUtc: null,
    }])).toBe('Completed');
  });
});
