import { Temporal } from '@js-temporal/polyfill';

import { generateCompletionSuccessor, type OccurrenceCandidate } from './occurrence';
import { assertValidScheduledItem, type ScheduledItemDefinition } from './schedule';

export type OccurrenceStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

export type StoredOccurrence = OccurrenceCandidate & {
  status: OccurrenceStatus;
  snoozedUntilUtc: string | null;
  completedAtUtc: string | null;
  missedAtUtc: string | null;
};

export type ScheduleAggregate = {
  item: ScheduledItemDefinition;
  occurrences: StoredOccurrence[];
};

export function storedOccurrence(candidate: OccurrenceCandidate): StoredOccurrence {
  return {
    ...candidate,
    status: 'scheduled',
    snoozedUntilUtc: null,
    completedAtUtc: null,
    missedAtUtc: null,
  };
}

function replaceOccurrence(aggregate: ScheduleAggregate, occurrence: StoredOccurrence): ScheduleAggregate {
  return {
    ...aggregate,
    occurrences: aggregate.occurrences.map((value) => value.id === occurrence.id ? occurrence : value),
  };
}

function unresolved(aggregate: ScheduleAggregate, occurrenceId: string): StoredOccurrence {
  const occurrence = aggregate.occurrences.find((value) => value.id === occurrenceId);
  if (!occurrence) throw new Error('Occurrence not found.');
  if (occurrence.status !== 'scheduled') throw new Error('Only a scheduled occurrence can be changed.');
  return occurrence;
}

export function pauseSchedule(aggregate: ScheduleAggregate): ScheduleAggregate {
  if (aggregate.item.status !== 'active') throw new Error('Only an active item can be paused.');
  return { ...aggregate, item: { ...aggregate.item, status: 'paused' } };
}

export function resumeSchedule(aggregate: ScheduleAggregate): ScheduleAggregate {
  if (aggregate.item.status !== 'paused') throw new Error('Only a paused item can be resumed.');
  return { ...aggregate, item: { ...aggregate.item, status: 'active' } };
}

export function stopSchedule(aggregate: ScheduleAggregate): ScheduleAggregate {
  if (aggregate.item.status !== 'active' && aggregate.item.status !== 'paused') {
    throw new Error('Only an active or paused item can be stopped.');
  }
  return {
    item: { ...aggregate.item, status: 'ended' },
    occurrences: aggregate.occurrences.map((occurrence) => occurrence.status === 'scheduled'
      ? { ...occurrence, status: 'cancelled', snoozedUntilUtc: null }
      : occurrence),
  };
}

export function dismissOccurrence(aggregate: ScheduleAggregate, occurrenceId: string): ScheduleAggregate {
  unresolved(aggregate, occurrenceId);
  return aggregate;
}

export function snoozeOccurrence(
  aggregate: ScheduleAggregate,
  occurrenceId: string,
  snoozedUntilUtc: string,
  nowUtc: string,
): ScheduleAggregate {
  const occurrence = unresolved(aggregate, occurrenceId);
  if (Temporal.Instant.compare(Temporal.Instant.from(snoozedUntilUtc), Temporal.Instant.from(nowUtc)) <= 0) {
    throw new Error('Snooze time must be in the future.');
  }
  return replaceOccurrence(aggregate, { ...occurrence, snoozedUntilUtc });
}

export function rescheduleOccurrence(
  aggregate: ScheduleAggregate,
  occurrenceId: string,
  scheduledAtUtc: string,
  scheduledLocal: string,
  effectiveTimeZone: string,
): ScheduleAggregate {
  const occurrence = unresolved(aggregate, occurrenceId);
  Temporal.Instant.from(scheduledAtUtc);
  return replaceOccurrence(aggregate, {
    ...occurrence,
    scheduledAtUtc,
    scheduledLocal,
    effectiveTimeZone,
    snoozedUntilUtc: null,
  });
}

export function completeOccurrence(
  aggregate: ScheduleAggregate,
  occurrenceId: string,
  completedAtUtc: string,
  deviceTimeZone: string,
): ScheduleAggregate {
  const occurrence = unresolved(aggregate, occurrenceId);
  let next: ScheduleAggregate = replaceOccurrence(aggregate, {
    ...occurrence,
    status: 'completed',
    completedAtUtc,
    snoozedUntilUtc: null,
  });
  const item = next.item;
  if (item.schedule.recurrenceAnchor !== 'completion') {
    if (item.schedule.frequency === 'none') next = { ...next, item: { ...item, status: 'ended' } };
    return next;
  }

  const successor = generateCompletionSuccessor(item, completedAtUtc, occurrence.sequenceNumber + 1, deviceTimeZone);
  if (!successor) return { ...next, item: { ...item, status: 'ended' } };
  return { ...next, occurrences: [...next.occurrences, storedOccurrence(successor)] };
}

export function markMissedOccurrences(aggregate: ScheduleAggregate, nowUtc: string): ScheduleAggregate {
  const now = Temporal.Instant.from(nowUtc);
  if (aggregate.item.schedule.recurrenceAnchor === 'completion') return aggregate;
  const past = aggregate.occurrences
    .filter((occurrence) => occurrence.status === 'scheduled' && Temporal.Instant.compare(Temporal.Instant.from(occurrence.scheduledAtUtc), now) < 0)
    .sort((a, b) => Temporal.Instant.compare(Temporal.Instant.from(a.scheduledAtUtc), Temporal.Instant.from(b.scheduledAtUtc)));
  const overdue = past.at(-1)?.id;
  return {
    ...aggregate,
    occurrences: aggregate.occurrences.map((occurrence) => past.some((value) => value.id === occurrence.id) && occurrence.id !== overdue
      ? { ...occurrence, status: 'missed', missedAtUtc: nowUtc }
      : occurrence),
  };
}

export function editSeries(
  aggregate: ScheduleAggregate,
  replacement: Omit<ScheduledItemDefinition, 'id' | 'revision' | 'status'>,
): ScheduleAggregate {
  const nextItem: ScheduledItemDefinition = {
    ...replacement,
    id: aggregate.item.id,
    revision: aggregate.item.revision + 1,
    status: 'active',
  };
  assertValidScheduledItem(nextItem);
  return {
    item: nextItem,
    occurrences: aggregate.occurrences.map((occurrence) => occurrence.status === 'scheduled'
      ? { ...occurrence, status: 'cancelled', snoozedUntilUtc: null }
      : occurrence),
  };
}

