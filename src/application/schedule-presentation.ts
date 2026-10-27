import type { ScheduledItemDefinition } from '../domain/schedule';
import type { StoredOccurrence } from '../domain/schedule-state';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type DisplayStatus = 'Active' | 'Paused' | 'Ended' | 'Completed';

export function displayedOccurrenceTime(occurrence: StoredOccurrence): string {
  return occurrence.snoozedUntilUtc ?? occurrence.scheduledAtUtc;
}

export function nextStoredOccurrence(occurrences: StoredOccurrence[]): StoredOccurrence | null {
  return occurrences
    .filter((value) => value.status === 'scheduled')
    .sort((a, b) => displayedOccurrenceTime(a).localeCompare(displayedOccurrenceTime(b)))[0] ?? null;
}

export function displayStatus(item: ScheduledItemDefinition, occurrences: StoredOccurrence[]): DisplayStatus {
  if (item.status === 'active') return 'Active';
  if (item.status === 'paused') return 'Paused';
  if (item.status === 'ended' && item.schedule.frequency === 'none' && occurrences.some((value) => value.status === 'completed')) {
    return 'Completed';
  }
  return 'Ended';
}

function shortTime(value: string): string {
  return value.slice(0, 5);
}

export function scheduleSummary(item: ScheduledItemDefinition): string {
  const schedule = item.schedule;
  if (schedule.frequency === 'none') return item.kind === 'event' ? 'One-time event' : 'One-time reminder';
  const interval = schedule.interval ?? 1;
  const unit = interval === 1 ? schedule.frequency : `${schedule.frequency}s`;
  let summary = `Every ${interval === 1 ? '' : `${interval} `}${unit}`;
  if (schedule.frequency === 'week' && schedule.weekdays.length) {
    summary = schedule.weekdays.map((day) => WEEKDAYS[day - 1]).filter(Boolean).join(', ');
  }
  if (schedule.timesOfDay.length) summary += ` at ${schedule.timesOfDay.map(shortTime).join(', ')}`;
  if (schedule.activeWindow) summary += ` · ${shortTime(schedule.activeWindow.startTime)}–${shortTime(schedule.activeWindow.endTime)}`;
  if (schedule.recurrenceAnchor === 'completion') summary += ' · after completion';
  if (schedule.stop.kind === 'on_date') summary += ` · through ${schedule.stop.onDate}`;
  if (schedule.stop.kind === 'after_occurrences') summary += ` · ${schedule.stop.afterOccurrences} times`;
  return summary;
}

export function isOverdue(occurrence: StoredOccurrence, nowUtc: string): boolean {
  return displayedOccurrenceTime(occurrence) < nowUtc;
}
