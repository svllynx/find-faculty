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
-- Schema v2. Applied idempotently by src/lib/db.ts on first connection.
--
-- Scope: one college (CCIS) in one building. Rooms are first-class rows with
-- floor-plan geometry, so the map a student sees is generated from the same
-- data the directory is built on, not drawn by hand.
--
-- Design notes:
--   * Office hours are stored as (weekday, start_minute, end_minute) integers,
--     so "is this window open right now?" is an integer comparison.
--   * Availability is DERIVED from office hours, and only overridden when a
--     faculty member voluntarily posts a status. FIND never infers a location.
--   * All writes to faculty data are recorded in audit_log.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS buildings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,        -- 'CCIS'
  name          TEXT    NOT NULL,               -- 'CCIS Building'
  landmark      TEXT    NOT NULL DEFAULT '',    -- how to find the building itself
  entrance      TEXT    NOT NULL DEFAULT '',    -- which door to use
  floors        INTEGER NOT NULL DEFAULT 1,     -- how many floors are mapped
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,        -- 'CS'
  name          TEXT    NOT NULL,               -- 'Computer Science'
  college_code  TEXT    NOT NULL DEFAULT 'CCIS',
  college_name  TEXT    NOT NULL DEFAULT 'College of Computer Science',
  building_id   INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  office        TEXT    NOT NULL DEFAULT '',    -- department office room number
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every mappable space on a floor. map_* are percentages of the floor-plan
-- viewport (0-100), so a room can be moved on the map by editing a row.
CREATE TABLE IF NOT EXISTS rooms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id   INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor         INTEGER NOT NULL DEFAULT 1,
  number        TEXT    NOT NULL,               -- '1', '2', ... as signed on the door
  name          TEXT    NOT NULL DEFAULT '',    -- 'Faculty Room 1'
  kind          TEXT    NOT NULL DEFAULT 'office'
                  CHECK (kind IN ('office','lab','lecture','facility')),
  map_x         REAL    NOT NULL DEFAULT 0,
  map_y         REAL    NOT NULL DEFAULT 0,
  map_w         REAL    NOT NULL DEFAULT 10,
  map_h         REAL    NOT NULL DEFAULT 10,
  note          TEXT    NOT NULL DEFAULT '',    -- 'Beside the stairs'
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (building_id, floor, number)
);

CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(building_id, floor);

CREATE TABLE IF NOT EXISTS faculty (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL,
  title         TEXT    NOT NULL DEFAULT '',    -- 'Associate Professor'
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  -- The office. Floor and building come from the room, so the directory and the
  -- floor plan can never disagree about where someone sits.
  room_id       INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  photo_url     TEXT    NOT NULL DEFAULT '',    -- data: URL or https: URL; blank = initials
  email         TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',    -- local / extension only
  subjects      TEXT    NOT NULL DEFAULT '',    -- comma-separated, searchable
  consultation_note TEXT NOT NULL DEFAULT '',   -- 'Message me before dropping by'
  -- Voluntary status override. NULL manual_status => availability comes from the
  -- published office hours. manual_until carries the end of a long absence, so
  -- "away for a week" is one row, not a promise someone has to remember to undo.
  manual_status TEXT    CHECK (manual_status IN ('available','unavailable','office_hours')),
  manual_note   TEXT    NOT NULL DEFAULT '',
  manual_until  TEXT,                           -- ISO datetime; status expires after this
  manual_set_at TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,     -- soft delete (on leave / no longer teaching)
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_faculty_name ON faculty(full_name);
CREATE INDEX IF NOT EXISTS idx_faculty_dept ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_room ON faculty(room_id);

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
  faculty_id    INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
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
