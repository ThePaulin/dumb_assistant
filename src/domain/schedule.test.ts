import { describe, expect, it } from 'vitest';

import { validateScheduledItem, type ScheduledItemDefinition } from './schedule';

function valid(): ScheduledItemDefinition {
  return {
    id: 'item', revision: 1, kind: 'reminder', status: 'active', title: 'Do thing', notes: null, event: null,
    schedule: {
      startLocal: '2026-01-01T09:00:00', timeZone: 'America/Toronto', timeZonePolicy: 'follow_device',
      frequency: 'day', interval: 1, preferredDayOfMonth: null, weekdays: [], timesOfDay: [],
      activeWindow: null, recurrenceAnchor: 'fixed', stop: { kind: 'never', onDate: null, afterOccurrences: null },
    },
  };
}

describe('validateScheduledItem', () => {
  it('accepts a valid recurring reminder', () => expect(validateScheduledItem(valid())).toEqual({ ok: true }));

  it.each([
    ['bad interval', (value: ScheduledItemDefinition) => { value.schedule.interval = 0; }, /Interval/],
    ['bad zone', (value: ScheduledItemDefinition) => { value.schedule.timeZone = 'Mars/Olympus'; }, /IANA/],
    ['overnight window', (value: ScheduledItemDefinition) => { value.schedule.frequency = 'hour'; value.schedule.activeWindow = { startTime: '22:00:00', endTime: '06:00:00' }; }, /same day/],
    ['monthly without preference', (value: ScheduledItemDefinition) => { value.schedule.frequency = 'month'; }, /preferred day/],
    ['weekly without weekdays', (value: ScheduledItemDefinition) => { value.schedule.frequency = 'week'; }, /weekday/],
    ['duplicate time', (value: ScheduledItemDefinition) => { value.schedule.timesOfDay = ['09:00:00', '09:00:00']; }, /unique/],
    ['one-time recurrence fields', (value: ScheduledItemDefinition) => { value.schedule.frequency = 'none'; value.schedule.interval = null; value.schedule.timesOfDay = ['09:00:00']; }, /one-time/],
  ])('rejects %s', (_name, change, message) => {
    const value = valid();
    change(value);
    const result = validateScheduledItem(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(message);
  });

  it('rejects completion-relative events and active-window events', () => {
    const value = valid();
    value.kind = 'event';
    value.event = { durationMinutes: 30, location: null, alertOffsetsMinutes: [10, 0] };
    value.schedule.frequency = 'hour';
    value.schedule.recurrenceAnchor = 'completion';
    value.schedule.activeWindow = { startTime: '09:00:00', endTime: '17:00:00' };
    const result = validateScheduledItem(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/Only reminders.*Events require fixed.*Events cannot use active windows/);
  });

  it('validates event duration and alert offsets', () => {
    const value = valid();
    value.kind = 'event';
    value.event = { durationMinutes: 0, location: null, alertOffsetsMinutes: [-1, -1] };
    const result = validateScheduledItem(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/positive duration.*unique non-negative/);
  });
});

