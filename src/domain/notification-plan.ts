import { Temporal } from '@js-temporal/polyfill';

import type { ScheduledItemDefinition } from './schedule';
import type { StoredOccurrence } from './schedule-state';

export type NotificationRegistration = {
  id: string;
  occurrenceId: string;
  alertOffsetMinutes: number;
  desiredAtUtc: string;
  state: 'pending' | 'registered' | 'failed' | 'cancelled';
  platformIdentifier: string | null;
};

export type DesiredRegistration = {
  id: string;
  occurrenceId: string;
  alertOffsetMinutes: number;
  desiredAtUtc: string;
};

export type NotificationPlan = {
  cancel: NotificationRegistration[];
  register: DesiredRegistration[];
  keep: NotificationRegistration[];
  deferred: DesiredRegistration[];
};

function registrationId(occurrenceId: string, offset: number): string {
  return `notification:${occurrenceId}:${offset}`;
}

function desiredFor(
  item: ScheduledItemDefinition,
  occurrences: StoredOccurrence[],
  now: Temporal.Instant,
): DesiredRegistration[] {
  if (item.status !== 'active') return [];
  const offsets = item.kind === 'event' ? item.event?.alertOffsetsMinutes ?? [] : [0];
  return occurrences.flatMap((occurrence) => {
    if (occurrence.status !== 'scheduled') return [];
    const base = occurrence.snoozedUntilUtc
      ? Temporal.Instant.from(occurrence.snoozedUntilUtc)
      : Temporal.Instant.from(occurrence.scheduledAtUtc);
    return offsets.map((offset) => ({
      id: registrationId(occurrence.id, offset),
      occurrenceId: occurrence.id,
      alertOffsetMinutes: offset,
      desiredAtUtc: base.subtract({ minutes: offset }).toString({ smallestUnit: 'millisecond' }),
    })).filter((value) => Temporal.Instant.compare(Temporal.Instant.from(value.desiredAtUtc), now) > 0);
  }).sort((a, b) => Temporal.Instant.compare(Temporal.Instant.from(a.desiredAtUtc), Temporal.Instant.from(b.desiredAtUtc)));
}

export function planNotificationReconciliation(
  item: ScheduledItemDefinition,
  occurrences: StoredOccurrence[],
  registrations: NotificationRegistration[],
  nowUtc: string,
  cap: number,
): NotificationPlan {
  if (!Number.isInteger(cap) || cap < 0) throw new Error('Notification cap cannot be negative.');
  const desired = desiredFor(item, occurrences, Temporal.Instant.from(nowUtc));
  const selected = desired.slice(0, cap);
  const deferred = desired.slice(cap);
  const selectedById = new Map(selected.map((value) => [value.id, value]));
  const cancel = registrations.filter((value) => {
    if (value.state !== 'registered' && value.state !== 'pending' && value.state !== 'failed') return false;
    const next = selectedById.get(value.id);
    return !next || next.desiredAtUtc !== value.desiredAtUtc;
  });
  const keep = registrations.filter((value) => {
    const next = selectedById.get(value.id);
    return value.state === 'registered' && !!next && next.desiredAtUtc === value.desiredAtUtc;
  });
  const keepIds = new Set(keep.map((value) => value.id));
  const register = selected.filter((value) => !keepIds.has(value.id));
  return { cancel, register, keep, deferred };
}

