import type { DatabaseSync } from "node:sqlite";
import { createMemoryDb } from "../lib/db";
import { hashPassword } from "../lib/password";

/**
 * A small CCIS building used by the data-layer and mutation tests:
 * two departments, two floors, three rooms, three faculty.
 */
export function seedTestDb(): DatabaseSync {
  const db = createMemoryDb();

  db.exec(`
    INSERT INTO buildings (code, name, landmark, entrance, floors) VALUES
      ('CCIS', 'CCIS Building', 'Beside the Engineering Hall', 'Main entrance on the quadrangle side', 2);

    INSERT INTO departments (code, name, college_code, college_name, building_id, office) VALUES
      ('CS', 'Computer Science',       'CCIS', 'College of Computer Science', 1, 'Room 1'),
      ('IT', 'Information Technology', 'CCIS', 'College of Computer Science', 1, 'Room 1');

    -- Rooms 1 and 3 on the 1st floor, room 12 upstairs.
    INSERT INTO rooms (building_id, floor, number, name, kind, map_x, map_y, map_w, map_h, note) VALUES
      (1, 1, '1',  'CCIS Faculty Office',   'office', 6,  8,  26, 35, 'First door on your left.'),
      (1, 1, '3',  'Faculty Room 3',        'office', 62, 8,  26, 35, ''),
      (1, 2, '12', 'Computer Laboratory 1', 'lab',    6,  61, 26, 35, '');

    INSERT INTO faculty (full_name, title, department_id, room_id, email, subjects) VALUES
      ('Juan Santos',     'Associate Professor', 1, 1, 'jsantos@campus.edu.ph', 'Data Structures, Algorithms'),
      ('Melchora Aquino', 'Professor',           2, 2, 'maquino@campus.edu.ph', 'Computer Networks, Cloud Computing'),
      ('Trinidad Tecson', 'Instructor',          2, 3, 'ttecson@campus.edu.ph', 'Technical Writing');

    INSERT INTO office_hours (faculty_id, weekday, start_minute, end_minute, location_note) VALUES
      (1, 1, 780, 900, ''),
      (1, 3, 780, 900, ''),
      (2, 1, 840, 960, 'Networking Laboratory');
  `);
  // Santos: Mon + Wed 1-3 PM.  Aquino: Mon 2-4 PM.  Tecson: no hours at all.

  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, role, faculty_id, display_name) VALUES (?, ?, ?, ?, ?)",
  );
  insertUser.run("admin@campus.edu.ph", hashPassword("admin1234"), "admin", null, "Admin");
  insertUser.run("jsantos@campus.edu.ph", hashPassword("faculty1234"), "faculty", 1, "Juan Santos");

  return db;
}

/** Monday 14:00 campus time - inside both Santos and Aquino blocks. */
export const MONDAY_2PM = new Date("2026-09-07T06:00:00Z");
/** Monday 10:00 campus time - nobody is holding office hours. */
export const MONDAY_10AM = new Date("2026-09-07T02:00:00Z");
