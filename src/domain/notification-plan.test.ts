import { describe, expect, it } from 'vitest';

import { planNotificationReconciliation, type NotificationRegistration } from './notification-plan';
import { generateOccurrences } from './occurrence';
import { storedOccurrence } from './schedule-state';
import type { ScheduledItemDefinition } from './schedule';

function reminder(): ScheduledItemDefinition {
  return {
    id: 'item', revision: 1, kind: 'reminder', status: 'active', title: 'Test', notes: null, event: null,
    schedule: {
      startLocal: '2026-01-01T09:00:00', timeZone: 'UTC', timeZonePolicy: 'fixed', frequency: 'day', interval: 1,
      preferredDayOfMonth: null, weekdays: [], timesOfDay: [], activeWindow: null, recurrenceAnchor: 'fixed',
      stop: { kind: 'after_occurrences', onDate: null, afterOccurrences: 3 },
    },
  };
}

function occurrences(item = reminder()) {
  return generateOccurrences(item, { fromUtc: '2026-01-01T00:00:00Z', toUtc: '2026-01-05T00:00:00Z', deviceTimeZone: 'UTC' }).map(storedOccurrence);
}

describe('planNotificationReconciliation', () => {
  it('registers nearest eligible notifications first and defers beyond the cap', () => {
    const item = reminder();
    const plan = planNotificationReconciliation(item, occurrences(item), [], '2025-12-31T00:00:00Z', 2);
    expect(plan.register.map((entry) => entry.desiredAtUtc)).toEqual(['2026-01-01T09:00:00.000Z', '2026-01-02T09:00:00.000Z']);
    expect(plan.deferred).toHaveLength(1);
  });

  it('keeps an exact platform registration idempotently', () => {
    const item = reminder();
    const first = planNotificationReconciliation(item, occurrences(item), [], '2025-12-31T00:00:00Z', 1).register[0]!;
    const existing: NotificationRegistration = { ...first, state: 'registered', platformIdentifier: 'platform-1' };
    const next = planNotificationReconciliation(item, occurrences(item), [existing], '2025-12-31T00:00:00Z', 1);
    expect(next.keep).toEqual([existing]);
    expect(next.register).toEqual([]);
    expect(next.cancel).toEqual([]);
  });

  it('cancels obsolete registrations after a pause', () => {
    const item = reminder();
    const first = planNotificationReconciliation(item, occurrences(item), [], '2025-12-31T00:00:00Z', 1).register[0]!;
    const existing: NotificationRegistration = { ...first, state: 'registered', platformIdentifier: 'platform-1' };
    const plan = planNotificationReconciliation({ ...item, status: 'paused' }, occurrences(item), [existing], '2025-12-31T00:00:00Z', 10);
    expect(plan.cancel).toEqual([existing]);
    expect(plan.register).toEqual([]);
  });

  it('replaces the occurrence registration after snooze', () => {
    const item = reminder();
    const values = occurrences(item);
    const firstPlan = planNotificationReconciliation(item, values, [], '2025-12-31T00:00:00Z', 1);
    const existing: NotificationRegistration = { ...firstPlan.register[0]!, state: 'registered', platformIdentifier: 'old' };
    values[0] = { ...values[0]!, snoozedUntilUtc: '2026-01-01T12:00:00Z' };
    const next = planNotificationReconciliation(item, values, [existing], '2025-12-31T00:00:00Z', 1);
    expect(next.cancel).toEqual([existing]);
    expect(next.register[0]?.desiredAtUtc).toBe('2026-01-01T12:00:00.000Z');
  });

  it('creates all event alert offsets before the event start', () => {
    const item = reminder();
    item.kind = 'event';
    item.event = { durationMinutes: 30, location: null, alertOffsetsMinutes: [30, 0] };
    const plan = planNotificationReconciliation(item, occurrences(item), [], '2025-12-31T00:00:00Z', 10);
    expect(plan.register.slice(0, 2).map((entry) => entry.desiredAtUtc)).toEqual(['2026-01-01T08:30:00.000Z', '2026-01-01T09:00:00.000Z']);
  });

  it('excludes completed, missed, cancelled, and past occurrence alerts', () => {
    const item = reminder();
    const values = occurrences(item);
    values[0] = { ...values[0]!, status: 'completed' };
    values[1] = { ...values[1]!, status: 'missed' };
    expect(planNotificationReconciliation(item, values, [], '2026-01-02T00:00:00Z', 10).register).toHaveLength(1);
  });
});

