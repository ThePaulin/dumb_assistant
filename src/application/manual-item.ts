import { Temporal } from '@js-temporal/polyfill';

import { firstCompletionOccurrence, generateOccurrences, type OccurrenceCandidate } from '../domain/occurrence';
import {
  validateScheduledItem,
  type Frequency,
  type ItemKind,
  type RecurrenceAnchor,
  type ScheduledItemDefinition,
  type StopRule,
  type TimeZonePolicy,
} from '../domain/schedule';
import { deviceTimeZone, localDateTimeToInstant } from '../domain/time';

export type ManualItemInput = {
  kind: ItemKind;
  title: string;
  notes: string;
  date: string;
  time: string;
  timeZonePolicy: TimeZonePolicy;
  timeZone: string;
  frequency: Frequency;
  interval: string;
  weekdays: number[];
  timesOfDay: string;
  useActiveWindow: boolean;
  activeWindowStart: string;
  activeWindowEnd: string;
  recurrenceAnchor: RecurrenceAnchor;
  stopKind: StopRule['kind'];
  stopOnDate: string;
  stopAfterOccurrences: string;
  eventDurationMinutes: string;
  eventLocation: string;
  eventAlertOffsets: string;
};

function normalizedTime(value: string): string {
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed;
}

function integer(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function integerList(value: string): number[] {
  if (!value.trim()) return [];
  return value.split(',').map((part) => Number(part.trim())).filter((part) => Number.isInteger(part));
}

function timeList(value: string): string[] {
  if (!value.trim()) return [];
  return value.split(',').map((part) => normalizedTime(part));
}

export function defaultManualItemInput(now = Temporal.Now.instant(), zone = deviceTimeZone()): ManualItemInput {
  const start = now.toZonedDateTimeISO(zone).add({ hours: 1 }).with({ minute: 0, second: 0, millisecond: 0 });
  return {
    kind: 'reminder',
    title: '',
    notes: '',
    date: start.toPlainDate().toString(),
    time: start.toPlainTime().toString({ smallestUnit: 'minute' }),
    timeZonePolicy: 'follow_device',
    timeZone: zone,
    frequency: 'none',
    interval: '1',
    weekdays: [],
    timesOfDay: '',
    useActiveWindow: false,
    activeWindowStart: '09:00',
    activeWindowEnd: '18:00',
    recurrenceAnchor: 'fixed',
    stopKind: 'never',
    stopOnDate: start.toPlainDate().add({ months: 1 }).toString(),
    stopAfterOccurrences: '10',
    eventDurationMinutes: '60',
    eventLocation: '',
    eventAlertOffsets: '10, 0',
  };
}

export function manualInputFromItem(item: ScheduledItemDefinition): ManualItemInput {
  const [date = '', fullTime = ''] = item.schedule.startLocal.split('T');
  return {
    kind: item.kind,
    title: item.title,
    notes: item.notes ?? '',
    date,
    time: fullTime.slice(0, 5),
    timeZonePolicy: item.schedule.timeZonePolicy,
    timeZone: item.schedule.timeZone,
    frequency: item.schedule.frequency,
    interval: String(item.schedule.interval ?? 1),
    weekdays: item.schedule.weekdays,
    timesOfDay: item.schedule.timesOfDay.map((value) => value.slice(0, 5)).join(', '),
    useActiveWindow: item.schedule.activeWindow !== null,
    activeWindowStart: item.schedule.activeWindow?.startTime.slice(0, 5) ?? '09:00',
    activeWindowEnd: item.schedule.activeWindow?.endTime.slice(0, 5) ?? '18:00',
    recurrenceAnchor: item.schedule.recurrenceAnchor,
    stopKind: item.schedule.stop.kind,
    stopOnDate: item.schedule.stop.onDate ?? date,
    stopAfterOccurrences: String(item.schedule.stop.afterOccurrences ?? 10),
    eventDurationMinutes: String(item.event?.durationMinutes ?? 60),
    eventLocation: item.event?.location ?? '',
    eventAlertOffsets: (item.event?.alertOffsetsMinutes ?? [10, 0]).join(', '),
  };
}

function stopRule(input: ManualItemInput): StopRule {
  if (input.stopKind === 'on_date') {
    return { kind: 'on_date', onDate: input.stopOnDate.trim(), afterOccurrences: null };
  }
  if (input.stopKind === 'after_occurrences') {
    return { kind: 'after_occurrences', onDate: null, afterOccurrences: integer(input.stopAfterOccurrences, 0) };
  }
  return { kind: 'never', onDate: null, afterOccurrences: null };
}

export function buildManualItem(
  input: ManualItemInput,
  identity: { id: string; revision: number },
): { item: ScheduledItemDefinition | null; errors: string[] } {
  const recurring = input.frequency !== 'none';
  const item: ScheduledItemDefinition = {
    id: identity.id,
    revision: identity.revision,
    kind: input.kind,
    status: 'active',
    title: input.title.trim(),
    notes: input.notes.trim() || null,
    schedule: {
      startLocal: `${input.date.trim()}T${normalizedTime(input.time)}`,
      timeZone: input.timeZone.trim(),
      timeZonePolicy: input.timeZonePolicy,
      frequency: input.frequency,
      interval: recurring ? integer(input.interval, 0) : null,
      preferredDayOfMonth: input.frequency === 'month' ? integer(input.date.split('-')[2] ?? '', 0) : null,
      weekdays: input.frequency === 'week' ? [...input.weekdays].sort((a, b) => a - b) : [],
      timesOfDay: input.frequency === 'day' || input.frequency === 'week' ? timeList(input.timesOfDay) : [],
      activeWindow: input.useActiveWindow && (input.frequency === 'minute' || input.frequency === 'hour')
        ? { startTime: normalizedTime(input.activeWindowStart), endTime: normalizedTime(input.activeWindowEnd) }
        : null,
      recurrenceAnchor: recurring && input.kind === 'reminder' ? input.recurrenceAnchor : 'fixed',
      stop: recurring ? stopRule(input) : { kind: 'never', onDate: null, afterOccurrences: null },
    },
    event: input.kind === 'event' ? {
      durationMinutes: integer(input.eventDurationMinutes, 0),
      location: input.eventLocation.trim() || null,
      alertOffsetsMinutes: [...new Set(integerList(input.eventAlertOffsets))].sort((a, b) => b - a),
    } : null,
  };
  const result = validateScheduledItem(item);
  return result.ok ? { item, errors: [] } : { item: null, errors: result.errors };
}

export function previewNextOccurrence(
  item: ScheduledItemDefinition,
  nowUtc = Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
  currentDeviceTimeZone = deviceTimeZone(),
): OccurrenceCandidate | null {
  if (item.schedule.recurrenceAnchor === 'completion') return firstCompletionOccurrence(item, currentDeviceTimeZone);
  let startUtc: string;
  try {
    const zone = item.schedule.timeZonePolicy === 'follow_device' ? currentDeviceTimeZone : item.schedule.timeZone;
    startUtc = localDateTimeToInstant(item.schedule.startLocal, zone);
  } catch {
    return null;
  }
  const horizonBase = Temporal.Instant.compare(Temporal.Instant.from(startUtc), Temporal.Instant.from(nowUtc)) > 0 ? startUtc : nowUtc;
  const horizon = Temporal.Instant.from(horizonBase).add({ hours: 24 * 370 }).toString({ smallestUnit: 'millisecond' });
  return generateOccurrences(item, { fromUtc: nowUtc, toUtc: horizon, deviceTimeZone: currentDeviceTimeZone, limit: 1 })[0] ?? null;
}
