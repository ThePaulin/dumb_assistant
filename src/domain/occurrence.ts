import { Temporal } from '@js-temporal/polyfill';

import {
  assertValidScheduledItem,
  effectiveTimeZone,
  type ScheduleDefinition,
  type ScheduledItemDefinition,
} from './schedule';

export type OccurrenceCandidate = {
  id: string;
  itemId: string;
  itemRevision: number;
  sequenceNumber: number;
  originalScheduledAtUtc: string;
  scheduledAtUtc: string;
  scheduledLocal: string;
  effectiveTimeZone: string;
  dstAdjusted: boolean;
};

export type GenerationWindow = {
  fromUtc: string;
  toUtc: string;
  deviceTimeZone: string;
  limit?: number;
};

const MAX_ENUMERATED_OCCURRENCES = 100_000;

function instantString(value: Temporal.Instant): string {
  return value.toString({ smallestUnit: 'millisecond' });
}

function localString(value: Temporal.PlainDateTime): string {
  return value.toString({ smallestUnit: 'second' });
}

function stableOccurrenceId(itemId: string, revision: number, instant: string): string {
  const value = `${itemId}:${revision}:${instant}`;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `occ_${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

function resolveLocal(local: Temporal.PlainDateTime, zone: string): { instant: Temporal.Instant; adjusted: boolean } {
  const zoned = local.toZonedDateTime(zone, { disambiguation: 'compatible' });
  return { instant: zoned.toInstant(), adjusted: !zoned.toPlainDateTime().equals(local) };
}

function timeOnDate(date: Temporal.PlainDate, time: string): Temporal.PlainDateTime {
  return date.toPlainDateTime(Temporal.PlainTime.from(time));
}

function scheduleTimes(schedule: ScheduleDefinition): Temporal.PlainTime[] {
  const fallback = Temporal.PlainDateTime.from(schedule.startLocal).toPlainTime();
  return (schedule.timesOfDay.length ? schedule.timesOfDay.map((value) => Temporal.PlainTime.from(value)) : [fallback])
    .sort(Temporal.PlainTime.compare);
}

function isWithinStop(schedule: ScheduleDefinition, local: Temporal.PlainDateTime, sequence: number): boolean {
  if (schedule.stop.kind === 'on_date' && Temporal.PlainDate.compare(local.toPlainDate(), Temporal.PlainDate.from(schedule.stop.onDate)) > 0) return false;
  if (schedule.stop.kind === 'after_occurrences' && sequence > schedule.stop.afterOccurrences) return false;
  return true;
}

function monthlyDate(anchor: Temporal.PlainDate, preferredDay: number, offset: number): Temporal.PlainDate {
  const month = anchor.with({ day: 1 }).add({ months: offset });
  return month.with({ day: Math.min(preferredDay, month.daysInMonth) });
}

function* fixedLocalCandidates(schedule: ScheduleDefinition): Generator<Temporal.PlainDateTime> {
  const start = Temporal.PlainDateTime.from(schedule.startLocal);
  const times = scheduleTimes(schedule);

  if (schedule.frequency === 'none') {
    yield start;
    return;
  }

  if ((schedule.frequency === 'minute' || schedule.frequency === 'hour') && schedule.activeWindow) {
    const step = schedule.frequency === 'minute' ? { minutes: schedule.interval! } : { hours: schedule.interval! };
    for (let dayOffset = 0; ; dayOffset += 1) {
      const date = start.toPlainDate().add({ days: dayOffset });
      const end = timeOnDate(date, schedule.activeWindow.endTime);
      for (let value = timeOnDate(date, schedule.activeWindow.startTime); Temporal.PlainDateTime.compare(value, end) <= 0; value = value.add(step)) {
        if (Temporal.PlainDateTime.compare(value, start) >= 0) yield value;
      }
    }
  }

  if (schedule.frequency === 'day') {
    for (let offset = 0; ; offset += schedule.interval!) {
      const date = start.toPlainDate().add({ days: offset });
      for (const time of times) {
        const value = date.toPlainDateTime(time);
        if (Temporal.PlainDateTime.compare(value, start) >= 0) yield value;
      }
    }
  }

  if (schedule.frequency === 'week') {
    const weekAnchor = start.toPlainDate().subtract({ days: start.dayOfWeek - 1 });
    const weekdays = [...schedule.weekdays].sort((a, b) => a - b);
    for (let weekOffset = 0; ; weekOffset += schedule.interval!) {
      for (const weekday of weekdays) {
        const date = weekAnchor.add({ weeks: weekOffset, days: weekday - 1 });
        for (const time of times) {
          const value = date.toPlainDateTime(time);
          if (Temporal.PlainDateTime.compare(value, start) >= 0) yield value;
        }
      }
    }
  }

  if (schedule.frequency === 'month') {
    for (let offset = 0; ; offset += schedule.interval!) {
      const date = monthlyDate(start.toPlainDate(), schedule.preferredDayOfMonth!, offset);
      for (const time of times) {
        const value = date.toPlainDateTime(time);
        if (Temporal.PlainDateTime.compare(value, start) >= 0) yield value;
      }
    }
  }
}

function* fixedElapsedCandidates(schedule: ScheduleDefinition, zone: string): Generator<{ local: Temporal.PlainDateTime; instant: Temporal.Instant; adjusted: boolean }> {
  const startLocal = Temporal.PlainDateTime.from(schedule.startLocal);
  const resolved = resolveLocal(startLocal, zone);
  const step = schedule.frequency === 'minute' ? { minutes: schedule.interval! } : { hours: schedule.interval! };
  for (let instant = resolved.instant; ; instant = instant.add(step)) {
    yield { local: instant.toZonedDateTimeISO(zone).toPlainDateTime(), instant, adjusted: false };
  }
}

export function generateOccurrences(item: ScheduledItemDefinition, window: GenerationWindow): OccurrenceCandidate[] {
  assertValidScheduledItem(item);
  if (item.status !== 'active' || item.schedule.recurrenceAnchor === 'completion' && item.schedule.frequency !== 'none') return [];
  const zone = effectiveTimeZone(item.schedule, window.deviceTimeZone);
  const from = Temporal.Instant.from(window.fromUtc);
  const to = Temporal.Instant.from(window.toUtc);
  const limit = window.limit ?? 64;
  if (Temporal.Instant.compare(from, to) > 0 || limit < 1) return [];
  const result: OccurrenceCandidate[] = [];
  let sequence = 0;
  const usesElapsed = !item.schedule.activeWindow && ['minute', 'hour'].includes(item.schedule.frequency);
  const candidates = usesElapsed ? fixedElapsedCandidates(item.schedule, zone) : fixedLocalCandidates(item.schedule);

  for (const raw of candidates) {
    sequence += 1;
    if (sequence > MAX_ENUMERATED_OCCURRENCES) throw new Error('Occurrence generation exceeded its safety bound.');
    const local = 'local' in raw ? raw.local : raw;
    if (!isWithinStop(item.schedule, local, sequence)) break;
    const resolved = 'instant' in raw ? raw : { ...resolveLocal(local, zone), local };
    if (Temporal.Instant.compare(resolved.instant, to) > 0) break;
    if (Temporal.Instant.compare(resolved.instant, from) < 0) continue;
    const utc = instantString(resolved.instant);
    result.push({
      id: stableOccurrenceId(item.id, item.revision, utc),
      itemId: item.id,
      itemRevision: item.revision,
      sequenceNumber: sequence,
      originalScheduledAtUtc: utc,
      scheduledAtUtc: utc,
      scheduledLocal: localString(local),
      effectiveTimeZone: zone,
      dstAdjusted: resolved.adjusted,
    });
    if (result.length >= limit) break;
  }
  return result;
}

function moveIntoActiveWindow(local: Temporal.PlainDateTime, schedule: ScheduleDefinition): Temporal.PlainDateTime {
  if (!schedule.activeWindow) return local;
  const start = timeOnDate(local.toPlainDate(), schedule.activeWindow.startTime);
  const end = timeOnDate(local.toPlainDate(), schedule.activeWindow.endTime);
  if (Temporal.PlainDateTime.compare(local, start) < 0) return start;
  if (Temporal.PlainDateTime.compare(local, end) > 0) return timeOnDate(local.toPlainDate().add({ days: 1 }), schedule.activeWindow.startTime);
  return local;
}

export function generateCompletionSuccessor(
  item: ScheduledItemDefinition,
  completedAtUtc: string,
  nextSequenceNumber: number,
  deviceTimeZone: string,
): OccurrenceCandidate | null {
  assertValidScheduledItem(item);
  const schedule = item.schedule;
  if (item.status !== 'active' || schedule.recurrenceAnchor !== 'completion' || schedule.frequency === 'none') return null;
  if (schedule.stop.kind === 'after_occurrences' && nextSequenceNumber > schedule.stop.afterOccurrences) return null;
  const zone = effectiveTimeZone(schedule, deviceTimeZone);
  const completion = Temporal.Instant.from(completedAtUtc);
  const completionLocal = completion.toZonedDateTimeISO(zone).toPlainDateTime();
  let local: Temporal.PlainDateTime;
  let instant: Temporal.Instant;
  let adjusted = false;

  if (schedule.frequency === 'minute' || schedule.frequency === 'hour') {
    const duration = schedule.frequency === 'minute' ? { minutes: schedule.interval! } : { hours: schedule.interval! };
    instant = completion.add(duration);
    local = moveIntoActiveWindow(instant.toZonedDateTimeISO(zone).toPlainDateTime(), schedule);
    if (!local.equals(instant.toZonedDateTimeISO(zone).toPlainDateTime())) {
      const resolved = resolveLocal(local, zone);
      instant = resolved.instant;
      adjusted = resolved.adjusted;
    }
  } else {
    if (schedule.frequency === 'day') local = completionLocal.add({ days: schedule.interval! });
    else if (schedule.frequency === 'week') local = completionLocal.add({ weeks: schedule.interval! });
    else {
      const date = monthlyDate(completionLocal.toPlainDate(), schedule.preferredDayOfMonth!, schedule.interval!);
      local = date.toPlainDateTime(completionLocal.toPlainTime());
    }
    const resolved = resolveLocal(local, zone);
    instant = resolved.instant;
    adjusted = resolved.adjusted;
  }
  if (!isWithinStop(schedule, local, nextSequenceNumber)) return null;
  const utc = instantString(instant);
  return {
    id: stableOccurrenceId(item.id, item.revision, utc),
    itemId: item.id,
    itemRevision: item.revision,
    sequenceNumber: nextSequenceNumber,
    originalScheduledAtUtc: utc,
    scheduledAtUtc: utc,
    scheduledLocal: localString(local),
    effectiveTimeZone: zone,
    dstAdjusted: adjusted,
  };
}

export function firstCompletionOccurrence(
  item: ScheduledItemDefinition,
  deviceTimeZone: string,
): OccurrenceCandidate | null {
  const fixed = { ...item, schedule: { ...item.schedule, recurrenceAnchor: 'fixed' as const } };
  const startInstant = resolveLocal(Temporal.PlainDateTime.from(item.schedule.startLocal), effectiveTimeZone(item.schedule, deviceTimeZone)).instant;
  return generateOccurrences(fixed, {
    fromUtc: instantString(startInstant),
    toUtc: instantString(startInstant.add({ hours: 370 * 24 })),
    deviceTimeZone,
    limit: 1,
  })[0] ?? null;
}

