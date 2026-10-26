import { describe, expect, it } from 'vitest';

import { firstCompletionOccurrence, generateCompletionSuccessor, generateOccurrences } from './occurrence';
import type { ScheduledItemDefinition } from './schedule';

function item(overrides: Partial<ScheduledItemDefinition['schedule']> = {}): ScheduledItemDefinition {
  return {
    id: 'item-1',
    revision: 1,
    kind: 'reminder',
    status: 'active',
    title: 'Take medicine',
    notes: null,
    schedule: {
      startLocal: '2026-01-01T09:00:00',
      timeZone: 'America/Toronto',
      timeZonePolicy: 'fixed',
      frequency: 'day',
      interval: 1,
      preferredDayOfMonth: null,
      weekdays: [],
      timesOfDay: [],
      activeWindow: null,
      recurrenceAnchor: 'fixed',
      stop: { kind: 'never', onDate: null, afterOccurrences: null },
      ...overrides,
    },
    event: null,
  };
}

function generate(value: ScheduledItemDefinition, from = '2026-01-01T00:00:00Z', to = '2026-01-10T00:00:00Z') {
  return generateOccurrences(value, { fromUtc: from, toUtc: to, deviceTimeZone: 'America/Vancouver', limit: 100 });
}

describe('generateOccurrences', () => {
  it('generates a one-time occurrence exactly once', () => {
    const result = generate(item({ frequency: 'none', interval: null }), undefined, '2026-01-02T00:00:00Z');
    expect(result).toHaveLength(1);
    expect(result[0]?.scheduledAtUtc).toBe('2026-01-01T14:00:00.000Z');
  });

  it('uses stable identities for an identical item revision and window', () => {
    const value = item();
    expect(generate(value).map((entry) => entry.id)).toEqual(generate(value).map((entry) => entry.id));
    expect(generate({ ...value, revision: 2 })[0]?.id).not.toBe(generate(value)[0]?.id);
  });

  it('honors inclusive start and end instants', () => {
    const result = generate(item(), '2026-01-01T14:00:00Z', '2026-01-02T14:00:00Z');
    expect(result.map((entry) => entry.scheduledAtUtc)).toEqual([
      '2026-01-01T14:00:00.000Z',
      '2026-01-02T14:00:00.000Z',
    ]);
  });

  it('applies an inclusive local end date', () => {
    const result = generate(item({ stop: { kind: 'on_date', onDate: '2026-01-03', afterOccurrences: null } }));
    expect(result).toHaveLength(3);
    expect(result.at(-1)?.scheduledLocal).toBe('2026-01-03T09:00:00');
  });

  it('stops after the configured generated occurrence count', () => {
    const result = generate(item({ stop: { kind: 'after_occurrences', onDate: null, afterOccurrences: 2 } }));
    expect(result.map((entry) => entry.sequenceNumber)).toEqual([1, 2]);
  });

  it('generates multiple explicit times on each eligible day', () => {
    const result = generate(item({ timesOfDay: ['17:00:00', '09:00:00'] }), undefined, '2026-01-02T23:00:00Z');
    expect(result.map((entry) => entry.scheduledLocal)).toEqual([
      '2026-01-01T09:00:00',
      '2026-01-01T17:00:00',
      '2026-01-02T09:00:00',
      '2026-01-02T17:00:00',
    ]);
  });

  it('generates selected weekdays in interval-aligned ISO weeks', () => {
    const result = generate(item({
      startLocal: '2026-01-05T09:00:00',
      frequency: 'week',
      interval: 2,
      weekdays: [1, 5],
    }), '2026-01-01T00:00:00Z', '2026-01-25T00:00:00Z');
    expect(result.map((entry) => entry.scheduledLocal)).toEqual([
      '2026-01-05T09:00:00',
      '2026-01-09T09:00:00',
      '2026-01-19T09:00:00',
      '2026-01-23T09:00:00',
    ]);
  });

  it('resets an interval at the inclusive active-window start each day', () => {
    const result = generate(item({
      startLocal: '2026-01-01T10:00:00',
      frequency: 'hour',
      interval: 3,
      activeWindow: { startTime: '09:00:00', endTime: '18:00:00' },
    }), undefined, '2026-01-02T23:59:59Z');
    expect(result.map((entry) => entry.scheduledLocal)).toEqual([
      '2026-01-01T12:00:00', '2026-01-01T15:00:00', '2026-01-01T18:00:00',
      '2026-01-02T09:00:00', '2026-01-02T12:00:00', '2026-01-02T15:00:00', '2026-01-02T18:00:00',
    ]);
  });

  it('does not invent an active-window end occurrence off the interval', () => {
    const result = generate(item({
      frequency: 'hour', interval: 4, activeWindow: { startTime: '09:00:00', endTime: '18:00:00' },
    }), undefined, '2026-01-02T00:00:00Z');
    expect(result.map((entry) => entry.scheduledLocal)).toEqual([
      '2026-01-01T09:00:00', '2026-01-01T13:00:00', '2026-01-01T17:00:00',
    ]);
  });

  it('clamps monthly dates and returns to the preferred day later', () => {
    const result = generate(item({
      startLocal: '2024-01-31T09:00:00', frequency: 'month', interval: 1, preferredDayOfMonth: 31,
    }), '2024-01-01T00:00:00Z', '2024-04-01T00:00:00Z');
    expect(result.map((entry) => entry.scheduledLocal)).toEqual([
      '2024-01-31T09:00:00', '2024-02-29T09:00:00', '2024-03-31T09:00:00',
    ]);
  });

  it('preserves daily wall time across daylight-saving changes', () => {
    const result = generate(item({ startLocal: '2026-03-07T09:00:00' }), '2026-03-07T00:00:00Z', '2026-03-10T00:00:00Z');
    expect(result.map((entry) => entry.scheduledAtUtc)).toEqual([
      '2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-09T13:00:00.000Z',
    ]);
  });

  it('moves nonexistent local times forward and flags the adjustment', () => {
    const result = generate(item({ startLocal: '2026-03-08T02:30:00' }), '2026-03-08T00:00:00Z', '2026-03-09T00:00:00Z');
    expect(result[0]).toMatchObject({ scheduledAtUtc: '2026-03-08T07:30:00.000Z', dstAdjusted: true });
  });

  it('chooses the earlier instant for a repeated local time', () => {
    const result = generate(item({ startLocal: '2026-11-01T01:30:00' }), '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z');
    expect(result[0]?.scheduledAtUtc).toBe('2026-11-01T05:30:00.000Z');
  });

  it('regenerates follow-device wall times in the supplied device zone', () => {
    const value = item({ timeZonePolicy: 'follow_device' });
    const toronto = generateOccurrences(value, { fromUtc: '2026-01-01T00:00:00Z', toUtc: '2026-01-02T00:00:00Z', deviceTimeZone: 'America/Toronto' });
    const vancouver = generateOccurrences(value, { fromUtc: '2026-01-01T00:00:00Z', toUtc: '2026-01-02T00:00:00Z', deviceTimeZone: 'America/Vancouver' });
    expect(toronto[0]?.scheduledAtUtc).toBe('2026-01-01T14:00:00.000Z');
    expect(vancouver[0]?.scheduledAtUtc).toBe('2026-01-01T17:00:00.000Z');
  });

  it('keeps a fixed-zone schedule in its stored zone', () => {
    const result = generate(item(), undefined, '2026-01-02T00:00:00Z');
    expect(result[0]).toMatchObject({ effectiveTimeZone: 'America/Toronto', scheduledAtUtc: '2026-01-01T14:00:00.000Z' });
  });

  it('uses elapsed time for fixed minute and hour intervals', () => {
    const result = generate(item({ startLocal: '2026-03-08T00:00:00', frequency: 'hour', interval: 2 }), '2026-03-08T04:00:00Z', '2026-03-08T12:00:00Z');
    expect(result.map((entry) => entry.scheduledAtUtc)).toEqual([
      '2026-03-08T05:00:00.000Z', '2026-03-08T07:00:00.000Z', '2026-03-08T09:00:00.000Z', '2026-03-08T11:00:00.000Z',
    ]);
  });

  it('returns nothing for paused schedules or completion-relative successors', () => {
    expect(generate({ ...item(), status: 'paused' })).toEqual([]);
    expect(generate(item({ recurrenceAnchor: 'completion' }))).toEqual([]);
  });
});

describe('completion-relative recurrence', () => {
  it('creates the initial unresolved occurrence from the schedule start', () => {
    const value = item({ frequency: 'day', interval: 2, recurrenceAnchor: 'completion' });
    expect(firstCompletionOccurrence(value, 'America/Toronto')).toMatchObject({ sequenceNumber: 1, scheduledLocal: '2026-01-01T09:00:00' });
  });

  it('anchors a calendar-day successor to actual completion', () => {
    const value = item({ recurrenceAnchor: 'completion' });
    expect(generateCompletionSuccessor(value, '2026-01-01T16:15:00Z', 2, 'America/Toronto')).toMatchObject({
      scheduledLocal: '2026-01-02T11:15:00', scheduledAtUtc: '2026-01-02T16:15:00.000Z',
    });
  });

  it('moves an elapsed successor after an active window to the next window start', () => {
    const value = item({ frequency: 'hour', interval: 3, recurrenceAnchor: 'completion', activeWindow: { startTime: '09:00:00', endTime: '18:00:00' } });
    expect(generateCompletionSuccessor(value, '2026-01-01T21:00:00Z', 2, 'America/Toronto')).toMatchObject({ scheduledLocal: '2026-01-02T09:00:00' });
  });

  it('ends after the final occurrence count', () => {
    const value = item({ recurrenceAnchor: 'completion', stop: { kind: 'after_occurrences', onDate: null, afterOccurrences: 2 } });
    expect(generateCompletionSuccessor(value, '2026-01-01T15:00:00Z', 3, 'America/Toronto')).toBeNull();
  });

  it('clamps completion-relative monthly recurrence to the preferred day', () => {
    const value = item({ frequency: 'month', interval: 1, preferredDayOfMonth: 31, recurrenceAnchor: 'completion' });
    expect(generateCompletionSuccessor(value, '2024-01-31T15:00:00Z', 2, 'America/Toronto')).toMatchObject({ scheduledLocal: '2024-02-29T10:00:00' });
  });
});

