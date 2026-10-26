import type * as SQLite from 'expo-sqlite';

import type { InterpretationProposal } from '../domain/proposal';
import { generateOccurrences } from '../domain/occurrence';
import type { ScheduledItemDefinition } from '../domain/schedule';
import { localDateTimeToInstant } from '../domain/time';

const DATABASE_NAME = 'dumb-assistant.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function newId(): Promise<string> {
  const { uuidv7 } = await import('../lib/ids');
  return uuidv7();
}

export const MIGRATION_1 = `
CREATE TABLE IF NOT EXISTS scheduled_items (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('reminder', 'event')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  notes TEXT,
  start_local TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  time_zone_policy TEXT NOT NULL CHECK (time_zone_policy IN ('follow_device', 'fixed')),
  frequency TEXT NOT NULL CHECK (frequency IN ('none', 'minute', 'hour', 'day', 'week', 'month')),
  interval_value INTEGER CHECK (interval_value IS NULL OR interval_value >= 1),
  preferred_day_of_month INTEGER CHECK (preferred_day_of_month BETWEEN 1 AND 31),
  recurrence_anchor TEXT NOT NULL CHECK (recurrence_anchor IN ('fixed', 'completion')),
  active_window_start TEXT,
  active_window_end TEXT,
  stop_kind TEXT NOT NULL CHECK (stop_kind IN ('never', 'on_date', 'after_occurrences')),
  stop_on_date TEXT,
  stop_after_occurrences INTEGER CHECK (stop_after_occurrences IS NULL OR stop_after_occurrences >= 1),
  generated_occurrence_count INTEGER NOT NULL DEFAULT 0 CHECK (generated_occurrence_count >= 0),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  CHECK ((frequency = 'none' AND interval_value IS NULL) OR (frequency <> 'none' AND interval_value IS NOT NULL)),
  CHECK ((stop_kind = 'on_date') = (stop_on_date IS NOT NULL)),
  CHECK ((stop_kind = 'after_occurrences') = (stop_after_occurrences IS NOT NULL)),
  CHECK ((active_window_start IS NULL) = (active_window_end IS NULL)),
  CHECK (kind = 'reminder' OR recurrence_anchor = 'fixed')
);
CREATE TABLE IF NOT EXISTS schedule_weekdays (
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  iso_weekday INTEGER NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  PRIMARY KEY (item_id, iso_weekday)
);
CREATE TABLE IF NOT EXISTS schedule_times (
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  local_time TEXT NOT NULL,
  PRIMARY KEY (item_id, local_time)
);
CREATE TABLE IF NOT EXISTS event_details (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 1),
  location TEXT
);
CREATE TABLE IF NOT EXISTS event_alerts (
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL CHECK (offset_minutes >= 0),
  PRIMARY KEY (item_id, offset_minutes)
);
CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  item_revision INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),
  original_scheduled_at_utc TEXT NOT NULL,
  scheduled_at_utc TEXT NOT NULL,
  scheduled_local TEXT NOT NULL,
  effective_time_zone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled')),
  snoozed_until_utc TEXT,
  completed_at_utc TEXT,
  missed_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  UNIQUE (item_id, item_revision, sequence_number),
  UNIQUE (item_id, item_revision, original_scheduled_at_utc)
);
CREATE TABLE IF NOT EXISTS notification_registrations (
  id TEXT PRIMARY KEY NOT NULL,
  occurrence_id TEXT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  alert_offset_minutes INTEGER NOT NULL DEFAULT 0 CHECK (alert_offset_minutes >= 0),
  platform_identifier TEXT,
  desired_at_utc TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'registered', 'failed', 'cancelled')),
  last_error_code TEXT,
  updated_at_utc TEXT NOT NULL,
  UNIQUE (occurrence_id, alert_offset_minutes)
);
CREATE TABLE IF NOT EXISTS interpretation_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('voice', 'text', 'manual')),
  transcript_text TEXT,
  proposal_json TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS diagnostic_events (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  engine TEXT,
  duration_ms INTEGER,
  result_kind TEXT NOT NULL,
  error_code TEXT,
  model_id TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  estimated_cost_usd REAL,
  created_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS occurrences_due_idx ON occurrences(status, scheduled_at_utc);
CREATE INDEX IF NOT EXISTS occurrences_item_idx ON occurrences(item_id, sequence_number);
CREATE INDEX IF NOT EXISTS notification_state_idx ON notification_registrations(state, desired_at_utc);
CREATE INDEX IF NOT EXISTS diagnostic_created_idx ON diagnostic_events(created_at_utc);
PRAGMA user_version = 1;
`;

export const DATABASE_MIGRATIONS = [{ version: 1, sql: MIGRATION_1 }] as const;

export type ReminderRow = {
  id: string;
  title: string;
  scheduled_at_utc: string;
  notification_state: 'pending' | 'registered' | 'failed' | 'cancelled';
  platform_identifier: string | null;
};

export type ConfirmationRecord = {
  itemId: string;
  occurrenceId: string;
  registrationId: string;
  title: string;
  scheduledAtUtc: string;
};

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= import('expo-sqlite').then(({ openDatabaseAsync }) => openDatabaseAsync(DATABASE_NAME)).then(async (db) => {
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    for (const migration of DATABASE_MIGRATIONS) {
      if ((current?.user_version ?? 0) < migration.version) {
        await db.withExclusiveTransactionAsync((transaction) => transaction.execAsync(migration.sql));
      }
    }
    return db;
  });
  return databasePromise;
}

export async function saveDraft(
  transcript: string,
  proposal: InterpretationProposal,
  source: 'voice' | 'text',
): Promise<string> {
  const db = await getDatabase();
  const id = await newId();
  const created = new Date().toISOString();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync(
    `INSERT INTO interpretation_drafts
      (id, schema_version, source_kind, transcript_text, proposal_json, expires_at_utc, created_at_utc)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    proposal.schema_version,
    source,
    transcript,
    JSON.stringify(proposal),
    expires,
    created,
  );
  return id;
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM interpretation_drafts WHERE id = ?', id);
}

export async function cleanupExpiredDrafts(now = new Date().toISOString()): Promise<number> {
  const db = await getDatabase();
  return (await db.runAsync('DELETE FROM interpretation_drafts WHERE expires_at_utc <= ?', now)).changes;
}

export async function confirmOneTimeReminder(
  draftId: string,
  proposal: InterpretationProposal,
): Promise<ConfirmationRecord> {
  if (
    proposal.result !== 'proposal' ||
    proposal.intent !== 'reminder' ||
    !proposal.title ||
    !proposal.schedule ||
    proposal.schedule.frequency !== 'none'
  ) {
    throw new Error('Only a validated one-time reminder can be confirmed in this spike.');
  }
  const schedule = proposal.schedule;
  const title = proposal.title;

  const db = await getDatabase();
  const itemId = await newId();
  const now = new Date().toISOString();
  const scheduledAtUtc = localDateTimeToInstant(
    schedule.start_local,
    schedule.time_zone,
  );
  if (new Date(scheduledAtUtc).getTime() <= Date.now()) {
    throw new Error('The reminder time must be in the future.');
  }
  const item: ScheduledItemDefinition = {
    id: itemId,
    revision: 1,
    kind: 'reminder',
    status: 'active',
    title,
    notes: proposal.notes,
    schedule: {
      startLocal: schedule.start_local,
      timeZone: schedule.time_zone,
      timeZonePolicy: schedule.time_zone_policy,
      frequency: 'none',
      interval: null,
      preferredDayOfMonth: null,
      weekdays: [],
      timesOfDay: [],
      activeWindow: null,
      recurrenceAnchor: 'fixed',
      stop: { kind: 'never', onDate: null, afterOccurrences: null },
    },
    event: null,
  };
  const occurrence = generateOccurrences(item, {
    fromUtc: now,
    toUtc: scheduledAtUtc,
    deviceTimeZone: schedule.time_zone,
    limit: 1,
  })[0];
  if (!occurrence) throw new Error('The reminder did not produce an occurrence.');
  const occurrenceId = occurrence.id;
  const registrationId = `notification:${occurrenceId}:0`;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const draft = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM interpretation_drafts WHERE id = ? AND expires_at_utc > ?',
      draftId,
      now,
    );
    if (!draft) throw new Error('This confirmation draft expired or was cancelled.');

    await transaction.runAsync(
      `INSERT INTO scheduled_items
       (id, revision, kind, status, title, notes, start_local, time_zone, time_zone_policy,
        frequency, interval_value, recurrence_anchor, stop_kind, generated_occurrence_count,
        created_at_utc, updated_at_utc)
       VALUES (?, 1, 'reminder', 'active', ?, ?, ?, ?, ?, 'none', NULL, 'fixed', 'never', 1, ?, ?)`,
      itemId,
      title,
      proposal.notes,
      schedule.start_local,
      schedule.time_zone,
      schedule.time_zone_policy,
      now,
      now,
    );
    await transaction.runAsync(
      `INSERT INTO occurrences
       (id, item_id, item_revision, sequence_number, original_scheduled_at_utc, scheduled_at_utc,
        scheduled_local, effective_time_zone, status, created_at_utc)
       VALUES (?, ?, 1, 1, ?, ?, ?, ?, 'scheduled', ?)`,
      occurrenceId,
      itemId,
      scheduledAtUtc,
      scheduledAtUtc,
      schedule.start_local,
      schedule.time_zone,
      now,
    );
    await transaction.runAsync(
      `INSERT INTO notification_registrations
       (id, occurrence_id, desired_at_utc, state, updated_at_utc)
       VALUES (?, ?, ?, 'pending', ?)`,
      registrationId,
      occurrenceId,
      scheduledAtUtc,
      now,
    );
    await transaction.runAsync('DELETE FROM interpretation_drafts WHERE id = ?', draftId);
  });

  return { itemId, occurrenceId, registrationId, title, scheduledAtUtc };
}

export async function markNotificationRegistered(
  registrationId: string,
  platformIdentifier: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notification_registrations
     SET state = 'registered', platform_identifier = ?, last_error_code = NULL, updated_at_utc = ?
     WHERE id = ?`,
    platformIdentifier,
    new Date().toISOString(),
    registrationId,
  );
}

export async function markNotificationFailed(
  registrationId: string,
  errorCode: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notification_registrations
     SET state = 'failed', last_error_code = ?, updated_at_utc = ? WHERE id = ?`,
    errorCode,
    new Date().toISOString(),
    registrationId,
  );
}

export type NotificationReconciliation = {
  cancel: Array<{ id: string; platform_identifier: string; remains_desired: number }>;
  register: Array<{ id: string; title: string; desired_at_utc: string }>;
};

export async function notificationReconciliation(
  nowUtc: string,
  cap: number,
): Promise<NotificationReconciliation> {
  const db = await getDatabase();
  const desired = await db.getAllAsync<{ id: string; title: string; desired_at_utc: string; state: string; platform_identifier: string | null }>(
    `SELECT n.id, i.title, n.desired_at_utc, n.state, n.platform_identifier
     FROM notification_registrations n
     JOIN occurrences o ON o.id = n.occurrence_id
     JOIN scheduled_items i ON i.id = o.item_id
     WHERE i.status = 'active' AND o.status = 'scheduled' AND n.desired_at_utc > ?
     ORDER BY n.desired_at_utc ASC, n.id ASC LIMIT ?`,
    nowUtc,
    cap,
  );
  const desiredIds = new Set(desired.map((row) => row.id));
  const withPlatform = await db.getAllAsync<{ id: string; platform_identifier: string; state: string }>(
    `SELECT id, platform_identifier, state FROM notification_registrations
     WHERE platform_identifier IS NOT NULL`,
  );
  return {
    cancel: withPlatform
      .filter((row) => !desiredIds.has(row.id) || row.state !== 'registered')
      .map((row) => ({ id: row.id, platform_identifier: row.platform_identifier, remains_desired: desiredIds.has(row.id) ? 1 : 0 })),
    register: desired
      .filter((row) => row.state !== 'registered')
      .map(({ id, title, desired_at_utc }) => ({ id, title, desired_at_utc })),
  };
}

export async function markNotificationCancelled(
  registrationId: string,
  remainsDesired: boolean,
  nowUtc: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notification_registrations
     SET state = ?, platform_identifier = NULL, updated_at_utc = ? WHERE id = ?`,
    remainsDesired ? 'pending' : 'cancelled',
    nowUtc,
    registrationId,
  );
}

export async function listReminders(): Promise<ReminderRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReminderRow>(
    `SELECT i.id, i.title, o.scheduled_at_utc,
            n.state AS notification_state, n.platform_identifier
     FROM scheduled_items i
     JOIN occurrences o ON o.item_id = i.id AND o.status = 'scheduled'
     JOIN notification_registrations n ON n.occurrence_id = o.id
     WHERE i.status = 'active'
     ORDER BY o.scheduled_at_utc ASC`,
  );
}

export async function removeReminder(id: string): Promise<string | null> {
  const db = await getDatabase();
  let platformIdentifier: string | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    platformIdentifier =
      (
        await transaction.getFirstAsync<{ platform_identifier: string | null }>(
          `SELECT n.platform_identifier
           FROM notification_registrations n JOIN occurrences o ON o.id = n.occurrence_id
           WHERE o.item_id = ? AND n.state = 'registered' LIMIT 1`,
          id,
        )
      )?.platform_identifier ?? null;
    await transaction.runAsync('DELETE FROM scheduled_items WHERE id = ?', id);
  });
  return platformIdentifier;
}

export async function reconcileableRegistrations(): Promise<
  Array<{ id: string; title: string; desired_at_utc: string }>
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT n.id, i.title, n.desired_at_utc
     FROM notification_registrations n
     JOIN occurrences o ON o.id = n.occurrence_id
     JOIN scheduled_items i ON i.id = o.item_id
     WHERE n.state IN ('pending', 'failed') AND o.status = 'scheduled' AND i.status = 'active'
       AND n.desired_at_utc > ?`,
    new Date().toISOString(),
  );
}
