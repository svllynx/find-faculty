import type { DatabaseSync } from "node:sqlite";
import { createMemoryDb } from "../lib/db";
import { hashPassword } from "../lib/password";

/** A tiny two-department campus used by the data-layer and mutation tests. */
export function seedTestDb(): DatabaseSync {
  const db = createMemoryDb();

  db.exec(`
    INSERT INTO buildings (code, name, landmark, entrance, map_x, map_y) VALUES
      ('FB', 'Faculty Building', 'Behind the quadrangle', 'Main entrance faces the quadrangle', 46, 38),
      ('SCI', 'Science Complex', 'Next to the greenhouse', 'Ramp entrance', 70, 68);

    INSERT INTO departments (code, name, building_id, office) VALUES
      ('CCS', 'College of Computer Studies', 1, 'Room 210'),
      ('MATH', 'Mathematics Department', 2, 'Room 302');

    INSERT INTO faculty (full_name, title, department_id, building_id, room, floor, email, subjects) VALUES
      ('Juan Santos', 'Associate Professor', 1, 1, '204', '2nd floor', 'jsantos@campus.edu.ph', 'Data Structures, Algorithms'),
      ('Melchora Aquino', 'Professor', 2, 2, '305', '3rd floor', 'maquino@campus.edu.ph', 'Calculus 1, Differential Equations'),
      ('Trinidad Tecson', 'Instructor', 2, 2, '312', '3rd floor', 'ttecson@campus.edu.ph', 'Statistics');

    INSERT INTO office_hours (faculty_id, weekday, start_minute, end_minute, location_note) VALUES
      (1, 1, 780, 900, ''),
      (1, 3, 780, 900, ''),
      (2, 1, 840, 960, 'Math Learning Centre');
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
