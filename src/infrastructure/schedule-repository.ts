import { Temporal } from '@js-temporal/polyfill';
import type { SQLiteDatabase } from 'expo-sqlite';

import { firstCompletionOccurrence, generateCompletionSuccessor, generateOccurrences, type OccurrenceCandidate } from '../domain/occurrence';
import { assertValidScheduledItem, type ScheduledItemDefinition, type StopRule } from '../domain/schedule';
import { getDatabase } from './database';

type ItemRow = {
  id: string;
  revision: number;
  kind: 'reminder' | 'event';
  status: 'draft' | 'active' | 'paused' | 'ended';
  title: string;
  notes: string | null;
  start_local: string;
  time_zone: string;
  time_zone_policy: 'follow_device' | 'fixed';
  frequency: 'none' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  interval_value: number | null;
  preferred_day_of_month: number | null;
  recurrence_anchor: 'fixed' | 'completion';
  active_window_start: string | null;
  active_window_end: string | null;
  stop_kind: 'never' | 'on_date' | 'after_occurrences';
  stop_on_date: string | null;
  stop_after_occurrences: number | null;
};

function stopRule(row: ItemRow): StopRule {
  if (row.stop_kind === 'on_date') return { kind: 'on_date', onDate: row.stop_on_date!, afterOccurrences: null };
  if (row.stop_kind === 'after_occurrences') return { kind: 'after_occurrences', onDate: null, afterOccurrences: row.stop_after_occurrences! };
  return { kind: 'never', onDate: null, afterOccurrences: null };
}

async function readItem(database: SQLiteDatabase, id: string): Promise<ScheduledItemDefinition> {
  const row = await database.getFirstAsync<ItemRow>('SELECT * FROM scheduled_items WHERE id = ?', id);
  if (!row) throw new Error('Scheduled item not found.');
  const weekdays = await database.getAllAsync<{ iso_weekday: number }>('SELECT iso_weekday FROM schedule_weekdays WHERE item_id = ? ORDER BY iso_weekday', id);
  const times = await database.getAllAsync<{ local_time: string }>('SELECT local_time FROM schedule_times WHERE item_id = ? ORDER BY local_time', id);
  const event = row.kind === 'event'
    ? await database.getFirstAsync<{ duration_minutes: number; location: string | null }>('SELECT duration_minutes, location FROM event_details WHERE item_id = ?', id)
    : null;
  const alerts = row.kind === 'event'
    ? await database.getAllAsync<{ offset_minutes: number }>('SELECT offset_minutes FROM event_alerts WHERE item_id = ? ORDER BY offset_minutes DESC', id)
    : [];
  return {
    id: row.id,
    revision: row.revision,
    kind: row.kind,
    status: row.status,
    title: row.title,
    notes: row.notes,
    schedule: {
      startLocal: row.start_local,
      timeZone: row.time_zone,
      timeZonePolicy: row.time_zone_policy,
      frequency: row.frequency,
      interval: row.interval_value,
      preferredDayOfMonth: row.preferred_day_of_month,
      weekdays: weekdays.map((value) => value.iso_weekday),
      timesOfDay: times.map((value) => value.local_time),
      activeWindow: row.active_window_start && row.active_window_end
        ? { startTime: row.active_window_start, endTime: row.active_window_end }
        : null,
      recurrenceAnchor: row.recurrence_anchor,
      stop: stopRule(row),
    },
    event: event ? {
      durationMinutes: event.duration_minutes,
      location: event.location,
      alertOffsetsMinutes: alerts.map((value) => value.offset_minutes),
    } : null,
  };
}

async function insertDefinition(database: SQLiteDatabase, item: ScheduledItemDefinition, nowUtc: string): Promise<void> {
  const schedule = item.schedule;
  await database.runAsync(
    `INSERT INTO scheduled_items
      (id, revision, kind, status, title, notes, start_local, time_zone, time_zone_policy, frequency,
       interval_value, preferred_day_of_month, recurrence_anchor, active_window_start, active_window_end,
       stop_kind, stop_on_date, stop_after_occurrences, generated_occurrence_count, created_at_utc, updated_at_utc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    item.id, item.revision, item.kind, item.status, item.title, item.notes, schedule.startLocal,
    schedule.timeZone, schedule.timeZonePolicy, schedule.frequency, schedule.interval,
    schedule.preferredDayOfMonth, schedule.recurrenceAnchor, schedule.activeWindow?.startTime ?? null,
    schedule.activeWindow?.endTime ?? null, schedule.stop.kind, schedule.stop.onDate,
    schedule.stop.afterOccurrences, nowUtc, nowUtc,
  );
  for (const weekday of schedule.weekdays) await database.runAsync('INSERT INTO schedule_weekdays (item_id, iso_weekday) VALUES (?, ?)', item.id, weekday);
  for (const time of schedule.timesOfDay) await database.runAsync('INSERT INTO schedule_times (item_id, local_time) VALUES (?, ?)', item.id, time);
  if (item.event) {
    await database.runAsync('INSERT INTO event_details (item_id, duration_minutes, location) VALUES (?, ?, ?)', item.id, item.event.durationMinutes, item.event.location);
    for (const offset of item.event.alertOffsetsMinutes) await database.runAsync('INSERT INTO event_alerts (item_id, offset_minutes) VALUES (?, ?)', item.id, offset);
  }
}

async function insertCandidate(database: SQLiteDatabase, item: ScheduledItemDefinition, candidate: OccurrenceCandidate, nowUtc: string): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO occurrences
      (id, item_id, item_revision, sequence_number, original_scheduled_at_utc, scheduled_at_utc,
       scheduled_local, effective_time_zone, status, created_at_utc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    candidate.id, item.id, item.revision, candidate.sequenceNumber, candidate.originalScheduledAtUtc,
    candidate.scheduledAtUtc, candidate.scheduledLocal, candidate.effectiveTimeZone, nowUtc,
  );
  const offsets = item.kind === 'event' ? item.event?.alertOffsetsMinutes ?? [] : [0];
  for (const offset of offsets) {
    const desired = Temporal.Instant.from(candidate.scheduledAtUtc).subtract({ minutes: offset }).toString({ smallestUnit: 'millisecond' });
    await database.runAsync(
      `INSERT OR IGNORE INTO notification_registrations
        (id, occurrence_id, alert_offset_minutes, desired_at_utc, state, updated_at_utc)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      `notification:${candidate.id}:${offset}`, candidate.id, offset, desired, nowUtc,
    );
  }
}

export async function createScheduledItem(
  item: ScheduledItemDefinition,
  nowUtc: string,
  horizonUtc: string,
  deviceTimeZone: string,
): Promise<void> {
  assertValidScheduledItem(item);
  if (item.status !== 'active') throw new Error('A newly created item must be active.');
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await insertDefinition(transaction, item, nowUtc);
    const candidates = item.schedule.recurrenceAnchor === 'completion'
      ? [firstCompletionOccurrence(item, deviceTimeZone)].filter((value): value is OccurrenceCandidate => value !== null)
      : generateOccurrences(item, { fromUtc: nowUtc, toUtc: horizonUtc, deviceTimeZone, limit: 256 });
    for (const candidate of candidates) await insertCandidate(transaction, item, candidate, nowUtc);
    const count = candidates.at(-1)?.sequenceNumber ?? 0;
    await transaction.runAsync('UPDATE scheduled_items SET generated_occurrence_count = ? WHERE id = ?', count, item.id);
  });
}

export async function getScheduledItem(id: string): Promise<ScheduledItemDefinition> {
  return readItem(await getDatabase(), id);
}

export async function materializeOccurrences(
  itemId: string,
  fromUtc: string,
  horizonUtc: string,
  deviceTimeZone: string,
): Promise<number> {
  const database = await getDatabase();
  let inserted = 0;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const item = await readItem(transaction, itemId);
    if (item.status !== 'active') return;
    let candidates: OccurrenceCandidate[] = [];
    if (item.schedule.recurrenceAnchor === 'completion') {
      const count = await transaction.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM occurrences WHERE item_id = ?', itemId);
      const first = count?.count === 0 ? firstCompletionOccurrence(item, deviceTimeZone) : null;
      if (first) candidates = [first];
    } else {
      candidates = generateOccurrences(item, { fromUtc, toUtc: horizonUtc, deviceTimeZone, limit: 256 });
    }
    for (const candidate of candidates) {
      const result = await transaction.runAsync(
        `INSERT OR IGNORE INTO occurrences
          (id, item_id, item_revision, sequence_number, original_scheduled_at_utc, scheduled_at_utc,
           scheduled_local, effective_time_zone, status, created_at_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
        candidate.id, item.id, item.revision, candidate.sequenceNumber, candidate.originalScheduledAtUtc,
        candidate.scheduledAtUtc, candidate.scheduledLocal, candidate.effectiveTimeZone, fromUtc,
      );
      if (result.changes) {
        inserted += 1;
        await insertCandidate(transaction, item, candidate, fromUtc);
      }
    }
    const maximum = await transaction.getFirstAsync<{ sequence: number | null }>('SELECT max(sequence_number) AS sequence FROM occurrences WHERE item_id = ? AND item_revision = ?', itemId, item.revision);
    await transaction.runAsync('UPDATE scheduled_items SET generated_occurrence_count = ?, updated_at_utc = ? WHERE id = ?', maximum?.sequence ?? 0, fromUtc, itemId);
  });
  return inserted;
}

async function cancelRegistrations(database: SQLiteDatabase, itemId: string, nowUtc: string): Promise<string[]> {
  const rows = await database.getAllAsync<{ platform_identifier: string | null }>(
    `SELECT n.platform_identifier FROM notification_registrations n
     JOIN occurrences o ON o.id = n.occurrence_id
     WHERE o.item_id = ? AND n.state = 'registered'`, itemId,
  );
  await database.runAsync(
    `UPDATE notification_registrations SET state = 'cancelled', updated_at_utc = ?
     WHERE occurrence_id IN (SELECT id FROM occurrences WHERE item_id = ?) AND state <> 'cancelled'`,
    nowUtc, itemId,
  );
  return rows.flatMap((row) => row.platform_identifier ? [row.platform_identifier] : []);
}

export async function pauseScheduledItem(itemId: string, nowUtc: string): Promise<string[]> {
  const database = await getDatabase();
  let identifiers: string[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync("UPDATE scheduled_items SET status = 'paused', updated_at_utc = ? WHERE id = ? AND status = 'active'", nowUtc, itemId);
    if (!result.changes) throw new Error('Only an active item can be paused.');
    identifiers = await cancelRegistrations(transaction, itemId, nowUtc);
  });
  return identifiers;
}

export async function stopScheduledItem(itemId: string, nowUtc: string): Promise<string[]> {
  const database = await getDatabase();
  let identifiers: string[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      "UPDATE scheduled_items SET status = 'ended', updated_at_utc = ? WHERE id = ? AND status IN ('active', 'paused')",
      nowUtc,
      itemId,
    );
    if (!result.changes) throw new Error('Only an active or paused item can be stopped.');
    identifiers = await cancelRegistrations(transaction, itemId, nowUtc);
    await transaction.runAsync(
      "UPDATE occurrences SET status = 'cancelled', snoozed_until_utc = NULL WHERE item_id = ? AND status = 'scheduled'",
      itemId,
    );
  });
  return identifiers;
}

export async function resumeScheduledItem(itemId: string, nowUtc: string, horizonUtc: string, deviceTimeZone: string): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync("UPDATE scheduled_items SET status = 'active', updated_at_utc = ? WHERE id = ? AND status = 'paused'", nowUtc, itemId);
  if (!result.changes) throw new Error('Only a paused item can be resumed.');
  await materializeOccurrences(itemId, nowUtc, horizonUtc, deviceTimeZone);
  await database.runAsync(
    `UPDATE notification_registrations SET state = 'pending', platform_identifier = NULL, updated_at_utc = ?
     WHERE occurrence_id IN (SELECT id FROM occurrences WHERE item_id = ? AND status = 'scheduled')`, nowUtc, itemId,
  );
}

export async function editScheduledItem(
  replacement: ScheduledItemDefinition,
  nowUtc: string,
  horizonUtc: string,
  deviceTimeZone: string,
): Promise<string[]> {
  assertValidScheduledItem(replacement);
  const database = await getDatabase();
  let identifiers: string[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const current = await readItem(transaction, replacement.id);
    if (replacement.revision !== current.revision + 1) throw new Error('A series edit must increment its revision by one.');
    identifiers = await cancelRegistrations(transaction, replacement.id, nowUtc);
    await transaction.runAsync(
      "UPDATE occurrences SET status = 'cancelled', snoozed_until_utc = NULL WHERE item_id = ? AND status = 'scheduled'",
      replacement.id,
    );
    await transaction.runAsync('DELETE FROM schedule_weekdays WHERE item_id = ?', replacement.id);
    await transaction.runAsync('DELETE FROM schedule_times WHERE item_id = ?', replacement.id);
    await transaction.runAsync('DELETE FROM event_alerts WHERE item_id = ?', replacement.id);
    await transaction.runAsync('DELETE FROM event_details WHERE item_id = ?', replacement.id);
    const schedule = replacement.schedule;
    await transaction.runAsync(
      `UPDATE scheduled_items SET revision = ?, kind = ?, status = 'active', title = ?, notes = ?,
       start_local = ?, time_zone = ?, time_zone_policy = ?, frequency = ?, interval_value = ?,
       preferred_day_of_month = ?, recurrence_anchor = ?, active_window_start = ?, active_window_end = ?,
       stop_kind = ?, stop_on_date = ?, stop_after_occurrences = ?, generated_occurrence_count = 0,
       updated_at_utc = ? WHERE id = ?`,
      replacement.revision, replacement.kind, replacement.title, replacement.notes, schedule.startLocal,
      schedule.timeZone, schedule.timeZonePolicy, schedule.frequency, schedule.interval,
      schedule.preferredDayOfMonth, schedule.recurrenceAnchor, schedule.activeWindow?.startTime ?? null,
      schedule.activeWindow?.endTime ?? null, schedule.stop.kind, schedule.stop.onDate,
      schedule.stop.afterOccurrences, nowUtc, replacement.id,
    );
    for (const weekday of schedule.weekdays) await transaction.runAsync('INSERT INTO schedule_weekdays (item_id, iso_weekday) VALUES (?, ?)', replacement.id, weekday);
    for (const time of schedule.timesOfDay) await transaction.runAsync('INSERT INTO schedule_times (item_id, local_time) VALUES (?, ?)', replacement.id, time);
    if (replacement.event) {
      await transaction.runAsync('INSERT INTO event_details (item_id, duration_minutes, location) VALUES (?, ?, ?)', replacement.id, replacement.event.durationMinutes, replacement.event.location);
      for (const offset of replacement.event.alertOffsetsMinutes) await transaction.runAsync('INSERT INTO event_alerts (item_id, offset_minutes) VALUES (?, ?)', replacement.id, offset);
    }
  });
  await materializeOccurrences(replacement.id, nowUtc, horizonUtc, deviceTimeZone);
  return identifiers;
}

export async function completeStoredOccurrence(occurrenceId: string, completedAtUtc: string, deviceTimeZone: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{ item_id: string; sequence_number: number; status: string }>('SELECT item_id, sequence_number, status FROM occurrences WHERE id = ?', occurrenceId);
    if (!row || row.status !== 'scheduled') throw new Error('Only a scheduled occurrence can be completed.');
    const item = await readItem(transaction, row.item_id);
    await transaction.runAsync("UPDATE occurrences SET status = 'completed', completed_at_utc = ?, snoozed_until_utc = NULL WHERE id = ?", completedAtUtc, occurrenceId);
    await transaction.runAsync("UPDATE notification_registrations SET state = 'cancelled', updated_at_utc = ? WHERE occurrence_id = ?", completedAtUtc, occurrenceId);
    if (item.schedule.frequency === 'none') {
      await transaction.runAsync("UPDATE scheduled_items SET status = 'ended', updated_at_utc = ? WHERE id = ?", completedAtUtc, item.id);
      return;
    }
    if (item.schedule.recurrenceAnchor === 'completion') {
      const successor = generateCompletionSuccessor(item, completedAtUtc, row.sequence_number + 1, deviceTimeZone);
      if (successor) await insertCandidate(transaction, item, successor, completedAtUtc);
      else await transaction.runAsync("UPDATE scheduled_items SET status = 'ended', updated_at_utc = ? WHERE id = ?", completedAtUtc, item.id);
    }
  });
}

export async function snoozeStoredOccurrence(occurrenceId: string, snoozedUntilUtc: string, nowUtc: string): Promise<void> {
  if (Temporal.Instant.compare(Temporal.Instant.from(snoozedUntilUtc), Temporal.Instant.from(nowUtc)) <= 0) throw new Error('Snooze time must be in the future.');
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync("UPDATE occurrences SET snoozed_until_utc = ? WHERE id = ? AND status = 'scheduled'", snoozedUntilUtc, occurrenceId);
    if (!result.changes) throw new Error('Only a scheduled occurrence can be snoozed.');
    await transaction.runAsync(
      `UPDATE notification_registrations SET desired_at_utc = ?, state = 'pending', updated_at_utc = ?
       WHERE occurrence_id = ?`, snoozedUntilUtc, nowUtc, occurrenceId,
    );
  });
}

export async function rescheduleStoredOccurrence(
  occurrenceId: string,
  scheduledAtUtc: string,
  scheduledLocal: string,
  effectiveTimeZone: string,
  nowUtc: string,
): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE occurrences SET scheduled_at_utc = ?, scheduled_local = ?, effective_time_zone = ?, snoozed_until_utc = NULL
       WHERE id = ? AND status = 'scheduled'`, scheduledAtUtc, scheduledLocal, effectiveTimeZone, occurrenceId,
    );
    if (!result.changes) throw new Error('Only a scheduled occurrence can be rescheduled.');
    const registrations = await transaction.getAllAsync<{ id: string; alert_offset_minutes: number }>('SELECT id, alert_offset_minutes FROM notification_registrations WHERE occurrence_id = ?', occurrenceId);
    for (const registration of registrations) {
      const desired = Temporal.Instant.from(scheduledAtUtc).subtract({ minutes: registration.alert_offset_minutes }).toString({ smallestUnit: 'millisecond' });
      await transaction.runAsync("UPDATE notification_registrations SET desired_at_utc = ?, state = 'pending', updated_at_utc = ? WHERE id = ?", desired, nowUtc, registration.id);
    }
  });
}

export async function deleteScheduledItem(itemId: string): Promise<string[]> {
  const database = await getDatabase();
  let identifiers: string[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    identifiers = (await transaction.getAllAsync<{ platform_identifier: string | null }>(
      `SELECT n.platform_identifier FROM notification_registrations n JOIN occurrences o ON o.id = n.occurrence_id
       WHERE o.item_id = ? AND n.platform_identifier IS NOT NULL`, itemId,
    )).flatMap((row) => row.platform_identifier ? [row.platform_identifier] : []);
    await transaction.runAsync('DELETE FROM scheduled_items WHERE id = ?', itemId);
  });
  return identifiers;
}

export async function activeScheduledItemIds(): Promise<string[]> {
  const rows = await (await getDatabase()).getAllAsync<{ id: string }>("SELECT id FROM scheduled_items WHERE status = 'active' ORDER BY id");
  return rows.map((row) => row.id);
}

export async function markStoredMissedOccurrences(nowUtc: string): Promise<number> {
  const database = await getDatabase();
  let changed = 0;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `WITH ranked AS (
         SELECT o.id, row_number() OVER (
           PARTITION BY o.item_id ORDER BY coalesce(o.snoozed_until_utc, o.scheduled_at_utc) DESC
         ) AS overdue_rank
         FROM occurrences o
         JOIN scheduled_items i ON i.id = o.item_id
         WHERE o.status = 'scheduled' AND coalesce(o.snoozed_until_utc, o.scheduled_at_utc) < ?
           AND i.status = 'active' AND i.recurrence_anchor = 'fixed'
       )
       UPDATE occurrences SET status = 'missed', missed_at_utc = ?
       WHERE id IN (SELECT id FROM ranked WHERE overdue_rank > 1)`,
      nowUtc,
      nowUtc,
    );
    changed = result.changes;
    await transaction.runAsync(
      `UPDATE notification_registrations SET state = 'cancelled', updated_at_utc = ?
       WHERE occurrence_id IN (SELECT id FROM occurrences WHERE status = 'missed')
         AND state <> 'cancelled'`,
      nowUtc,
    );
  });
  return changed;
}

