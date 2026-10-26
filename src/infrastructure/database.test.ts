// Node 22+ supplies this runtime module; the mobile project intentionally has no Node type dependency.
// @ts-expect-error -- test-only built-in module
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { DATABASE_MIGRATIONS } from './database';

describe('database migrations', () => {
  it('builds the complete v1 relational schema from an empty database', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of DATABASE_MIGRATIONS) database.exec(migration.sql);
    const version = database.prepare('PRAGMA user_version').get() as { user_version: number };
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>;
    expect(version.user_version).toBe(1);
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining([
      'scheduled_items', 'schedule_weekdays', 'schedule_times', 'event_details', 'event_alerts',
      'occurrences', 'notification_registrations', 'interpretation_drafts', 'app_settings', 'diagnostic_events',
    ]));
    database.close();
  });

  it('enforces idempotent occurrence and registration keys', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(DATABASE_MIGRATIONS[0].sql);
    database.prepare(`INSERT INTO scheduled_items
      (id, revision, kind, status, title, start_local, time_zone, time_zone_policy, frequency, interval_value,
       recurrence_anchor, stop_kind, generated_occurrence_count, created_at_utc, updated_at_utc)
      VALUES (?, 1, 'reminder', 'active', 'Test', '2026-01-01T09:00:00', 'UTC', 'fixed', 'day', 1,
       'fixed', 'never', 0, ?, ?)`).run('item', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    const insertOccurrence = database.prepare(`INSERT INTO occurrences
      (id, item_id, item_revision, sequence_number, original_scheduled_at_utc, scheduled_at_utc,
       scheduled_local, effective_time_zone, status, created_at_utc)
      VALUES (?, 'item', 1, 1, '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z', '2026-01-01T09:00:00', 'UTC', 'scheduled', '2026-01-01T00:00:00Z')`);
    insertOccurrence.run('occurrence');
    expect(() => insertOccurrence.run('duplicate')).toThrow(/UNIQUE/);
    const insertRegistration = database.prepare(`INSERT INTO notification_registrations
      (id, occurrence_id, alert_offset_minutes, desired_at_utc, state, updated_at_utc)
      VALUES (?, 'occurrence', 0, '2026-01-01T09:00:00Z', 'pending', '2026-01-01T00:00:00Z')`);
    insertRegistration.run('registration');
    expect(() => insertRegistration.run('duplicate-registration')).toThrow(/UNIQUE/);
    database.close();
  });

  it('cascades an item delete through occurrences and registrations', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(DATABASE_MIGRATIONS[0].sql);
    database.exec(`
      INSERT INTO scheduled_items
        (id, revision, kind, status, title, start_local, time_zone, time_zone_policy, frequency, interval_value,
         recurrence_anchor, stop_kind, generated_occurrence_count, created_at_utc, updated_at_utc)
      VALUES ('item', 1, 'reminder', 'active', 'Test', '2026-01-01T09:00:00', 'UTC', 'fixed', 'none', NULL,
        'fixed', 'never', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      INSERT INTO occurrences
        (id, item_id, item_revision, sequence_number, original_scheduled_at_utc, scheduled_at_utc,
         scheduled_local, effective_time_zone, status, created_at_utc)
      VALUES ('occurrence', 'item', 1, 1, '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z',
        '2026-01-01T09:00:00', 'UTC', 'scheduled', '2026-01-01T00:00:00Z');
      INSERT INTO notification_registrations
        (id, occurrence_id, desired_at_utc, state, updated_at_utc)
      VALUES ('registration', 'occurrence', '2026-01-01T09:00:00Z', 'registered', '2026-01-01T00:00:00Z');
      DELETE FROM scheduled_items WHERE id = 'item';
    `);
    expect(database.prepare('SELECT count(*) AS count FROM occurrences').get()).toEqual({ count: 0 });
    expect(database.prepare('SELECT count(*) AS count FROM notification_registrations').get()).toEqual({ count: 0 });
    database.close();
  });
});

