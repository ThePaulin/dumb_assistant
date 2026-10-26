import { Temporal } from '@js-temporal/polyfill';

export type ItemKind = 'reminder' | 'event';
export type ItemStatus = 'draft' | 'active' | 'paused' | 'ended';
export type Frequency = 'none' | 'minute' | 'hour' | 'day' | 'week' | 'month';
export type RecurrenceAnchor = 'fixed' | 'completion';
export type TimeZonePolicy = 'follow_device' | 'fixed';

export type StopRule =
  | { kind: 'never'; onDate: null; afterOccurrences: null }
  | { kind: 'on_date'; onDate: string; afterOccurrences: null }
  | { kind: 'after_occurrences'; onDate: null; afterOccurrences: number };

export type ScheduleDefinition = {
  startLocal: string;
  timeZone: string;
  timeZonePolicy: TimeZonePolicy;
  frequency: Frequency;
  interval: number | null;
  preferredDayOfMonth: number | null;
  weekdays: number[];
  timesOfDay: string[];
  activeWindow: { startTime: string; endTime: string } | null;
  recurrenceAnchor: RecurrenceAnchor;
  stop: StopRule;
};

export type EventDefinition = {
  durationMinutes: number;
  location: string | null;
  alertOffsetsMinutes: number[];
};

export type ScheduledItemDefinition = {
  id: string;
  revision: number;
  kind: ItemKind;
  status: ItemStatus;
  title: string;
  notes: string | null;
  schedule: ScheduleDefinition;
  event: EventDefinition | null;
};

export type ScheduleValidation = { ok: true } | { ok: false; errors: string[] };

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:00$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d:00$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validTemporal(value: string, parser: (value: string) => unknown): boolean {
  try {
    parser(value);
    return true;
  } catch {
    return false;
  }
}

export function effectiveTimeZone(
  schedule: Pick<ScheduleDefinition, 'timeZone' | 'timeZonePolicy'>,
  deviceTimeZone: string,
): string {
  return schedule.timeZonePolicy === 'follow_device' ? deviceTimeZone : schedule.timeZone;
}

export function validateScheduledItem(item: ScheduledItemDefinition): ScheduleValidation {
  const errors: string[] = [];
  const schedule = item.schedule;

  if (!item.title.trim()) errors.push('Title must not be empty.');
  if (!Number.isInteger(item.revision) || item.revision < 1) errors.push('Revision must be positive.');
  if (!LOCAL_DATE_TIME.test(schedule.startLocal) || !validTemporal(schedule.startLocal, Temporal.PlainDateTime.from)) {
    errors.push('Start must be a valid local date-time with seconds set to 00.');
  }
  try {
    Temporal.Now.instant().toZonedDateTimeISO(schedule.timeZone);
  } catch {
    errors.push('Time zone must be a valid IANA identifier.');
  }
  if (schedule.frequency === 'none' ? schedule.interval !== null : !Number.isInteger(schedule.interval) || schedule.interval! < 1) {
    errors.push('Interval must be null for one-time schedules and positive for recurrence.');
  }
  if (new Set(schedule.weekdays).size !== schedule.weekdays.length || schedule.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    errors.push('Weekdays must be unique ISO weekday values from 1 through 7.');
  }
  if (new Set(schedule.timesOfDay).size !== schedule.timesOfDay.length || schedule.timesOfDay.some((time) => !LOCAL_TIME.test(time))) {
    errors.push('Times of day must be unique HH:mm:00 values.');
  }
  if (schedule.frequency === 'none' && (schedule.weekdays.length || schedule.timesOfDay.length || schedule.activeWindow || schedule.stop.kind !== 'never')) {
    errors.push('A one-time schedule cannot contain recurrence options.');
  }
  if (schedule.frequency === 'week' && schedule.weekdays.length === 0) {
    errors.push('A weekly schedule requires at least one weekday.');
  }
  if (schedule.weekdays.length > 0 && schedule.frequency !== 'week') {
    errors.push('Selected weekdays require weekly frequency.');
  }
  if (schedule.timesOfDay.length > 1 && (schedule.frequency !== 'day' && schedule.frequency !== 'week')) {
    errors.push('Multiple daily times require daily or weekly fixed recurrence.');
  }
  if (schedule.activeWindow) {
    if (!['minute', 'hour'].includes(schedule.frequency)) errors.push('Active windows require minute or hour frequency.');
    if (!LOCAL_TIME.test(schedule.activeWindow.startTime) || !LOCAL_TIME.test(schedule.activeWindow.endTime)) {
      errors.push('Active-window boundaries must use HH:mm:00.');
    } else if (schedule.activeWindow.startTime >= schedule.activeWindow.endTime) {
      errors.push('Active windows must end later on the same day.');
    }
  }
  if (schedule.recurrenceAnchor === 'completion') {
    if (item.kind !== 'reminder') errors.push('Only reminders support completion-relative recurrence.');
    if (schedule.frequency === 'none') errors.push('A one-time schedule cannot be completion-relative.');
    if (schedule.weekdays.length || schedule.timesOfDay.length > 1) {
      errors.push('Completion-relative recurrence cannot use weekdays or multiple times.');
    }
  }
  if (item.kind === 'event') {
    if (!item.event || !Number.isInteger(item.event.durationMinutes) || item.event.durationMinutes < 1) {
      errors.push('Events require a positive duration.');
    }
    if (schedule.recurrenceAnchor !== 'fixed') errors.push('Events require fixed recurrence.');
    if (schedule.activeWindow) errors.push('Events cannot use active windows.');
    if (item.event && (new Set(item.event.alertOffsetsMinutes).size !== item.event.alertOffsetsMinutes.length || item.event.alertOffsetsMinutes.some((offset) => !Number.isInteger(offset) || offset < 0))) {
      errors.push('Event alert offsets must be unique non-negative minutes.');
    }
  } else if (item.event) {
    errors.push('Only events can contain event details.');
  }
  if (schedule.preferredDayOfMonth !== null && (!Number.isInteger(schedule.preferredDayOfMonth) || schedule.preferredDayOfMonth < 1 || schedule.preferredDayOfMonth > 31)) {
    errors.push('Preferred day of month must be between 1 and 31.');
  }
  if (schedule.frequency === 'month' && schedule.preferredDayOfMonth === null) {
    errors.push('Monthly recurrence requires a preferred day of month.');
  }
  if (schedule.stop.kind === 'on_date' && (!LOCAL_DATE.test(schedule.stop.onDate) || !validTemporal(schedule.stop.onDate, Temporal.PlainDate.from))) {
    errors.push('End date must be a valid local date.');
  }
  if (schedule.stop.kind === 'after_occurrences' && (!Number.isInteger(schedule.stop.afterOccurrences) || schedule.stop.afterOccurrences < 1)) {
    errors.push('Occurrence-count stop must be positive.');
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertValidScheduledItem(item: ScheduledItemDefinition): void {
  const result = validateScheduledItem(item);
  if (!result.ok) throw new Error(result.errors.join(' '));
}

