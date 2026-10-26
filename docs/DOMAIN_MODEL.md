# Domain and Persistence Model

This document defines the implementation-ready local model for schema version 1. The JSON export shape is in `schemas/scheduled-item.v1.schema.json`; SQLite remains the source of truth on device.

## Aggregate boundaries

### Scheduled item

Owns user intent and recurrence configuration. A scheduled item is either a reminder or event and has a monotonically increasing revision.

### Occurrence

Represents one concrete due instant generated from one item revision. Historical occurrences do not change when the parent series is edited.

### Notification registration

Records an attempt to mirror an occurrence alert into the operating system. It is derived state, not proof that a notification was delivered.

### Interpretation draft

Holds an unconfirmed proposal during the capture flow. It cannot generate occurrences or notifications.

## Identifiers

- Application identifiers use UUIDv7 strings.
- A generated occurrence has a stable deterministic key derived from `item_id`, `item_revision`, and its scheduled UTC instant.
- A notification registration is unique by `occurrence_id` and `alert_offset_minutes`.
- Provider request identifiers may be retained for debugging, but never raw provider responses containing user content.

## Item states

```text
draft --confirm--> active --pause--> paused
  |                  |  ^             |
  +--delete----------+  +---resume-----+
                     |                |
                     +----end---------+
```

- `draft` cannot own scheduled notifications.
- `active` can generate and register occurrences.
- `paused` retains definitions and history but owns no future registrations.
- `ended` is read-only except for reactivation through an explicit edit that creates a new revision.
- Delete is a transactional hard delete in the local-only MVP.

## Occurrence states

```text
scheduled --> completed
    |  |
    |  +--> missed
    +-----> cancelled
```

Snooze is represented by `snoozed_until_utc` on a scheduled occurrence, not by a separate terminal state. Notification dismissal does not change occurrence state.

## SQLite schema v1

Timestamps ending in `_utc` are ISO 8601 UTC strings with millisecond precision. Local date-times use `YYYY-MM-DDTHH:mm:ss`; local dates use `YYYY-MM-DD`; local times use `HH:mm:ss`.

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE scheduled_items (
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

CREATE TABLE schedule_weekdays (
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  iso_weekday INTEGER NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  PRIMARY KEY (item_id, iso_weekday)
);

CREATE TABLE schedule_times (
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  local_time TEXT NOT NULL,
  PRIMARY KEY (item_id, local_time)
);

CREATE TABLE event_details (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 1),
  location TEXT
);

CREATE TABLE event_alerts (
  item_id TEXT NOT NULL REFERENCES scheduled_items(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL CHECK (offset_minutes >= 0),
  PRIMARY KEY (item_id, offset_minutes)
);

CREATE TABLE occurrences (
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

CREATE TABLE notification_registrations (
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

CREATE TABLE interpretation_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('voice', 'text', 'manual')),
  transcript_text TEXT,
  proposal_json TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE INDEX occurrences_due_idx ON occurrences(status, scheduled_at_utc);
CREATE INDEX occurrences_item_idx ON occurrences(item_id, sequence_number);
CREATE INDEX notification_state_idx ON notification_registrations(state, desired_at_utc);
```

## Application-level invariants

SQLite `CHECK` constraints provide a first line of defense; the domain validator must also enforce:

- One-time schedules have no weekdays, extra times, window, or stop condition.
- Weekday schedules have at least one weekday and one time.
- Completion-relative schedules are reminders and have no weekday set or multiple daily times.
- Active windows apply only to minute/hour intervals and do not cross midnight.
- Event details exist only for events and every event has exactly one details row.
- An active item has at least one future occurrence unless a completion-relative occurrence is currently overdue.
- At most one unresolved occurrence exists for a completion-relative item.
- Occurrence history remains attached to the item revision that generated it.
- Only a confirmed draft may transition to an active scheduled item.

## Transactions

The following operations are atomic database transactions:

- Confirm draft and create first occurrences
- Edit a series, increment revision, cancel future occurrences, and generate replacements
- Pause/resume and update registration intentions
- Complete an occurrence and generate a completion-relative successor
- Delete item and all dependent rows

Operating-system registration occurs after the database transaction. Failure updates registration state to `failed` and is surfaced for retry; it does not roll back the user's saved item.

## Migrations

- Migrations are ordered, immutable SQL or TypeScript modules committed with the app.
- `PRAGMA user_version` records the applied schema number.
- Each migration runs in a transaction when SQLite permits it.
- The application refuses writes if migration fails and offers retry/recovery rather than partially opening the database.
- Destructive migrations require an export/backup strategy before release.
- Migration tests start from every previously released schema fixture and verify data plus schedule behavior.

## Repository interfaces

The domain layer depends on interfaces, not SQLite APIs directly:

```text
ScheduledItemRepository
  get(id)
  listUpcoming(range)
  save(item, expectedRevision)
  delete(id)

OccurrenceRepository
  listForItem(id)
  listDue(range)
  insertGenerated(occurrences)
  updateResolution(id, resolution)

NotificationRegistrationRepository
  desired(range)
  markRegistered(...)
  markFailed(...)
  markCancelled(...)
```

This keeps recurrence tests independent of React Native and allows notification reconciliation to be tested with a fake platform adapter.
