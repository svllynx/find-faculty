/**
 * The FIND schema, as a string rather than a .sql file read at runtime.
 *
 * Next.js only traces files it can see statically, so a readFileSync of
 * src/lib/schema.sql is not guaranteed to exist in a serverless bundle.
 * Keeping the SQL here means the schema ships wherever the code ships, and
 * stays the single source of truth for the app, the tests and the seeder.
 */
export const SCHEMA = `
-- FIND — Faculty Information & Navigate Direction
-- Schema v1. Applied idempotently by src/lib/db.ts on first connection.
-- Design notes:
--   * Office hours are stored as (weekday, start_minute, end_minute) integers, not strings,
--     so "is this window open right now?" is an index-friendly integer comparison.
--   * Availability is DERIVED from office hours, and only overridden when a faculty member
--     voluntarily posts a manual status. FIND never stores an inferred physical location.
--   * All writes to faculty data are recorded in audit_log so a department can verify accuracy.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS buildings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,        -- e.g. 'FB'
  name          TEXT    NOT NULL,               -- e.g. 'Faculty Building'
  landmark      TEXT    NOT NULL DEFAULT '',    -- 'across from the Oval, beside the Chapel'
  entrance      TEXT    NOT NULL DEFAULT '',    -- 'Main entrance faces the Oval'
  map_x         REAL    NOT NULL DEFAULT 50,    -- 0-100 position on the schematic campus map
  map_y         REAL    NOT NULL DEFAULT 50,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,        -- 'CCS'
  name          TEXT    NOT NULL,               -- 'College of Computer Studies'
  building_id   INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  office        TEXT    NOT NULL DEFAULT '',    -- department office room, for walk-ins
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faculty (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL,
  title         TEXT    NOT NULL DEFAULT '',    -- 'Associate Professor'
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  building_id   INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  room          TEXT    NOT NULL DEFAULT '',    -- '204'
  floor         TEXT    NOT NULL DEFAULT '',    -- '2nd floor'
  email         TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',    -- local / extension only
  subjects      TEXT    NOT NULL DEFAULT '',    -- comma-separated, searchable
  consultation_note TEXT NOT NULL DEFAULT '',   -- 'Message me before dropping by'
  -- Voluntary manual status. NULL manual_status => availability is derived from office hours.
  manual_status TEXT    CHECK (manual_status IN ('available','unavailable','office_hours')),
  manual_note   TEXT    NOT NULL DEFAULT '',
  manual_until  TEXT,                           -- ISO datetime; status auto-expires after this
  manual_set_at TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,     -- soft delete (on leave / no longer teaching)
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_faculty_name  ON faculty(full_name);
CREATE INDEX IF NOT EXISTS idx_faculty_dept  ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_bldg  ON faculty(building_id);

CREATE TABLE IF NOT EXISTS office_hours (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  faculty_id    INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  weekday       INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday
  start_minute  INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute    INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  location_note TEXT    NOT NULL DEFAULT '',    -- 'Dept. office, not my room'
  CHECK (end_minute > start_minute)
);

CREATE INDEX IF NOT EXISTS idx_hours_faculty ON office_hours(faculty_id);
CREATE INDEX IF NOT EXISTS idx_hours_window  ON office_hours(weekday, start_minute, end_minute);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,               -- scrypt: salt:derivedKey (hex)
  role          TEXT    NOT NULL CHECK (role IN ('faculty','admin')),
  faculty_id    INTEGER REFERENCES faculty(id) ON DELETE SET NULL,  -- record this user may edit
  display_name  TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT    PRIMARY KEY,            -- 256-bit random hex
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email   TEXT    NOT NULL DEFAULT '',    -- kept even if the user is deleted
  action        TEXT    NOT NULL,               -- 'faculty.update', 'hours.replace', ...
  faculty_id    INTEGER,
  detail        TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`;
