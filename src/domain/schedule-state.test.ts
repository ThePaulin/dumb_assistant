import { describe, expect, it } from 'vitest';

import { firstCompletionOccurrence, generateOccurrences } from './occurrence';
import {
  completeOccurrence,
  dismissOccurrence,
  editSeries,
  markMissedOccurrences,
  pauseSchedule,
  rescheduleOccurrence,
  resumeSchedule,
  snoozeOccurrence,
  storedOccurrence,
  stopSchedule,
  type ScheduleAggregate,
} from './schedule-state';
import type { ScheduledItemDefinition } from './schedule';

function definition(completion = false): ScheduledItemDefinition {
  return {
    id: 'item', revision: 1, kind: 'reminder', status: 'active', title: 'Water plants', notes: null, event: null,
    schedule: {
      startLocal: '2026-01-01T09:00:00', timeZone: 'America/Toronto', timeZonePolicy: 'fixed',
      frequency: 'day', interval: 1, preferredDayOfMonth: null, weekdays: [], timesOfDay: [], activeWindow: null,
      recurrenceAnchor: completion ? 'completion' : 'fixed', stop: { kind: 'never', onDate: null, afterOccurrences: null },
    },
  };
}

function aggregate(completion = false): ScheduleAggregate {
  const item = definition(completion);
  const candidate = completion
    ? firstCompletionOccurrence(item, 'America/Toronto')!
    : generateOccurrences(item, { fromUtc: '2026-01-01T00:00:00Z', toUtc: '2026-01-03T00:00:00Z', deviceTimeZone: 'America/Toronto', limit: 2 })[0]!;
  return { item, occurrences: [storedOccurrence(candidate)] };
}

describe('schedule state transitions', () => {
  it('pauses and resumes only through valid states', () => {
    const paused = pauseSchedule(aggregate());
    expect(paused.item.status).toBe('paused');
    expect(resumeSchedule(paused).item.status).toBe('active');
    expect(() => pauseSchedule(paused)).toThrow('active');
  });

  it('manually stops an item and cancels its unresolved occurrences', () => {
    const result = stopSchedule(aggregate());
    expect(result.item.status).toBe('ended');
    expect(result.occurrences[0]?.status).toBe('cancelled');
    expect(() => resumeSchedule(result)).toThrow('paused');
  });

  it('treats notification dismissal as no domain state change', () => {
    const value = aggregate();
    expect(dismissOccurrence(value, value.occurrences[0]!.id)).toBe(value);
  });

  it('snoozes one occurrence without moving its fixed schedule', () => {
    const value = aggregate();
    const occurrence = value.occurrences[0]!;
    const result = snoozeOccurrence(value, occurrence.id, '2026-01-01T16:00:00Z', '2026-01-01T14:00:00Z');
    expect(result.occurrences[0]).toMatchObject({
      originalScheduledAtUtc: '2026-01-01T14:00:00.000Z',
      scheduledAtUtc: '2026-01-01T14:00:00.000Z',
      snoozedUntilUtc: '2026-01-01T16:00:00Z',
    });
    expect(() => snoozeOccurrence(value, occurrence.id, '2026-01-01T13:00:00Z', '2026-01-01T14:00:00Z')).toThrow('future');
  });

  it('reschedules one occurrence while retaining its original identity instant', () => {
    const value = aggregate();
    const occurrence = value.occurrences[0]!;
    const result = rescheduleOccurrence(value, occurrence.id, '2026-01-01T17:00:00Z', '2026-01-01T12:00:00', 'America/Toronto');
    expect(result.occurrences[0]).toMatchObject({
      originalScheduledAtUtc: '2026-01-01T14:00:00.000Z', scheduledAtUtc: '2026-01-01T17:00:00Z',
    });
  });

  it('completes a fixed occurrence without changing future cadence', () => {
    const value = aggregate();
    const occurrence = value.occurrences[0]!;
    const result = completeOccurrence(value, occurrence.id, '2026-01-01T18:00:00Z', 'America/Toronto');
    expect(result.occurrences[0]).toMatchObject({ status: 'completed', completedAtUtc: '2026-01-01T18:00:00Z' });
    expect(result.occurrences).toHaveLength(1);
  });

  it('creates one completion-relative successor from actual resolution time', () => {
    const value = aggregate(true);
    const result = completeOccurrence(value, value.occurrences[0]!.id, '2026-01-01T18:00:00Z', 'America/Toronto');
    expect(result.occurrences).toHaveLength(2);
    expect(result.occurrences[1]).toMatchObject({ sequenceNumber: 2, scheduledLocal: '2026-01-02T13:00:00', status: 'scheduled' });
  });

  it('ends a completion-relative item when its final occurrence is completed', () => {
    const value = aggregate(true);
    value.item.schedule.stop = { kind: 'after_occurrences', onDate: null, afterOccurrences: 1 };
    const result = completeOccurrence(value, value.occurrences[0]!.id, '2026-01-01T18:00:00Z', 'America/Toronto');
    expect(result.item.status).toBe('ended');
    expect(result.occurrences).toHaveLength(1);
  });

  it('keeps the most recent fixed overdue occurrence and marks older ones missed', () => {
    const value = aggregate();
    const candidates = generateOccurrences(value.item, { fromUtc: '2026-01-01T00:00:00Z', toUtc: '2026-01-04T00:00:00Z', deviceTimeZone: 'America/Toronto' });
    value.occurrences = candidates.map(storedOccurrence);
    const result = markMissedOccurrences(value, '2026-01-03T20:00:00Z');
    expect(result.occurrences.map((entry) => entry.status)).toEqual(['missed', 'missed', 'scheduled']);
  });

  it('does not mark a completion-relative unresolved occurrence missed', () => {
    const value = aggregate(true);
    expect(markMissedOccurrences(value, '2026-02-01T00:00:00Z')).toEqual(value);
  });

  it('increments the revision and cancels unresolved old-series occurrences on edit', () => {
    const value = aggregate();
    const { id: _id, revision: _revision, status: _status, ...replacement } = value.item;
    replacement.title = 'Water garden';
    const result = editSeries(value, replacement);
    expect(result.item).toMatchObject({ id: 'item', revision: 2, status: 'active', title: 'Water garden' });
    expect(result.occurrences[0]?.status).toBe('cancelled');
  });
});

