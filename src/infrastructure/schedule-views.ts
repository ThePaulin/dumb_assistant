import type { ScheduledItemDefinition } from '../domain/schedule';
import type { StoredOccurrence } from '../domain/schedule-state';
import { getDatabase } from './database';
import { getScheduledItem } from './schedule-repository';

type OccurrenceRow = {
  id: string;
  item_id: string;
  item_revision: number;
  sequence_number: number;
  original_scheduled_at_utc: string;
  scheduled_at_utc: string;
  scheduled_local: string;
  effective_time_zone: string;
  status: StoredOccurrence['status'];
  snoozed_until_utc: string | null;
  completed_at_utc: string | null;
  missed_at_utc: string | null;
};

export type ScheduleView = {
  item: ScheduledItemDefinition;
  occurrences: StoredOccurrence[];
  hasNotificationFailure: boolean;
};

function occurrence(row: OccurrenceRow): StoredOccurrence {
  return {
    id: row.id,
    itemId: row.item_id,
    itemRevision: row.item_revision,
    sequenceNumber: row.sequence_number,
    originalScheduledAtUtc: row.original_scheduled_at_utc,
    scheduledAtUtc: row.scheduled_at_utc,
    scheduledLocal: row.scheduled_local,
    effectiveTimeZone: row.effective_time_zone,
    dstAdjusted: false,
    status: row.status,
    snoozedUntilUtc: row.snoozed_until_utc,
    completedAtUtc: row.completed_at_utc,
    missedAtUtc: row.missed_at_utc,
  };
}

export async function getScheduleView(id: string): Promise<ScheduleView> {
  const database = await getDatabase();
  const [item, rows, failure] = await Promise.all([
    getScheduledItem(id),
    database.getAllAsync<OccurrenceRow>(
      `SELECT * FROM occurrences
       WHERE item_id = ? AND (
         status <> 'scheduled' OR id = (
           SELECT id FROM occurrences
           WHERE item_id = ? AND status = 'scheduled'
           ORDER BY coalesce(snoozed_until_utc, scheduled_at_utc) ASC LIMIT 1
         )
       )
       ORDER BY CASE status WHEN 'scheduled' THEN 0 ELSE 1 END, sequence_number DESC
       LIMIT 100`,
      id,
      id,
    ),
    database.getFirstAsync<{ count: number }>(
      `SELECT count(*) AS count FROM notification_registrations n
       JOIN occurrences o ON o.id = n.occurrence_id
       WHERE o.item_id = ? AND n.state = 'failed'`,
      id,
    ),
  ]);
  return { item, occurrences: rows.map(occurrence), hasNotificationFailure: (failure?.count ?? 0) > 0 };
}

export async function listScheduleViews(): Promise<ScheduleView[]> {
  const rows = await (await getDatabase()).getAllAsync<{ id: string }>(
    `SELECT id FROM scheduled_items WHERE status <> 'draft'
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at_utc DESC`,
  );
  return Promise.all(rows.map((row) => getScheduleView(row.id)));
}
