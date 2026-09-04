/**
 * The demo campus: 5 buildings, 6 departments, 16 faculty with real office-hour
 * blocks, and the accounts listed in the README.
 *
 * Lives here (not in scripts/) so three callers share one copy: the `npm run
 * seed` CLI, and the deployed app when it boots onto an empty database -- which
 * is what happens on a serverless host, where the only writable directory is
 * /tmp and every cold start begins with nothing.
 *
 * Re-running is safe: the data tables are cleared first, AUTOINCREMENT counters
 * included, so ids are identical on every seed and demo links keep working.
 */
import { randomBytes, scryptSync } from "node:crypto";

/** @param {import("node:sqlite").DatabaseSync} db */
export function seedCampus(db) {
  const hash = (pw) => {
    const salt = randomBytes(16);
    return `${salt.toString("hex")}:${scryptSync(pw, salt, 64).toString("hex")}`;
  };

  const hm = (h, m = 0) => h * 60 + m;
  const MON = 1;
  const TUE = 2;
  const WED = 3;
  const THU = 4;
  const FRI = 5;
  const SAT = 6;

  db.exec("PRAGMA foreign_keys = ON");
  const tables = ["audit_log", "sessions", "office_hours", "users", "faculty", "departments", "buildings"];
  for (const table of tables) db.exec(`DELETE FROM ${table}`);
  // Reset the AUTOINCREMENT counters too, so ids are identical on every re-seed
  // and the demo links / smoke test stay valid.
  for (const table of tables) {
    db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
  }

  // --- Buildings --------------------------------------------------------------
  // map_x / map_y are 0-100 coordinates on the schematic campus map at /map.
  const buildings = [
    ["FB", "Faculty Building", "Behind the Main Quadrangle, beside the flagpole", "Main entrance faces the quadrangle; the stairs are on your left as you enter", 46, 38],
    ["ENG", "Engineering Hall", "Corner of University Ave. and the covered walk", "Enter through the lobby with the steel truss ceiling", 74, 30],
    ["AB", "Arts & Letters Building", "Across the Oval from the Chapel", "Use the arched side entrance; the main doors are locked after 5 PM", 24, 60],
    ["SCI", "Science Complex", "Past the Oval, next to the greenhouse", "Take the ramp entrance on the greenhouse side", 70, 68],
    ["ADM", "Administration Building", "Fronting the main gate", "Registrar wing on the ground floor, dean offices on the second", 46, 84],
  ];
  const buildingId = {};
  {
    const insert = db.prepare(
      "INSERT INTO buildings (code, name, landmark, entrance, map_x, map_y) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const b of buildings) buildingId[b[0]] = Number(insert.run(...b).lastInsertRowid);
  }

  // --- Departments ------------------------------------------------------------
  const departments = [
    ["CCS", "College of Computer Studies", "FB", "Room 210"],
    ["COE", "College of Engineering", "ENG", "Room 105"],
    ["CAS", "College of Arts & Sciences", "AB", "Room 120"],
    ["CBA", "College of Business Administration", "ADM", "Room 208"],
    ["CTE", "College of Teacher Education", "AB", "Room 231"],
    ["MATH", "Mathematics Department", "SCI", "Room 302"],
  ];
  const deptId = {};
  {
    const insert = db.prepare(
      "INSERT INTO departments (code, name, building_id, office) VALUES (?, ?, ?, ?)",
    );
    for (const [code, name, bldg, office] of departments) {
      deptId[code] = Number(insert.run(code, name, buildingId[bldg], office).lastInsertRowid);
    }
  }

  // --- Faculty ----------------------------------------------------------------
  // [name, title, dept, building, room, floor, email, phone, subjects, note, hours[]]
  const faculty = [
    ["Juan Santos", "Associate Professor", "CCS", "FB", "204", "2nd floor", "jsantos@campus.edu.ph", "local 214",
      "Data Structures, Algorithms, CS Thesis 1",
      "Walk-ins welcome during office hours. For thesis consultations, please bring your latest draft.",
      [[MON, hm(13), hm(15)], [WED, hm(13), hm(15)], [FRI, hm(9), hm(11)]]],

    ["Maria Clara Reyes", "Professor", "CCS", "FB", "206", "2nd floor", "mcreyes@campus.edu.ph", "local 216",
      "Software Engineering, Systems Analysis and Design",
      "Email me a short agenda first so we can use the time well.",
      [[TUE, hm(10), hm(12)], [THU, hm(10), hm(12)]]],

    ["Andres Bonifacio Cruz", "Assistant Professor", "CCS", "FB", "211", "2nd floor", "abcruz@campus.edu.ph", "local 219",
      "Web Development, Database Systems",
      "",
      [[MON, hm(8), hm(10)], [WED, hm(15), hm(17)], [FRI, hm(15), hm(17)]]],

    ["Liwayway Dimaculangan", "Department Chair", "CCS", "FB", "210", "2nd floor", "ldimaculangan@campus.edu.ph", "local 210",
      "Capstone Project, IT Governance",
      "Chair duties often pull me out. Check my posted status before walking over.",
      [[TUE, hm(14), hm(16)], [THU, hm(14), hm(16)]]],

    ["Rogelio Mabini", "Professor", "COE", "ENG", "108", "Ground floor", "rmabini@campus.edu.ph", "local 305",
      "Statics, Dynamics, Mechanics of Deformable Bodies",
      "",
      [[MON, hm(9), hm(11)], [TUE, hm(9), hm(11)], [THU, hm(13), hm(14, 30)]]],

    ["Corazon Villanueva", "Associate Professor", "COE", "ENG", "212", "2nd floor", "cvillanueva@campus.edu.ph", "local 312",
      "Circuits 1, Electronics, Signals and Systems",
      "Lab consultations happen in ENG-215, not my office. See the note on each block.",
      [[WED, hm(10), hm(12), "Electronics Lab, ENG-215"], [FRI, hm(13), hm(15)]]],

    ["Emilio Aguinaldo Torres", "Instructor", "COE", "ENG", "119", "Ground floor", "eatorres@campus.edu.ph", "local 308",
      "Engineering Drawing, CAD",
      "",
      [[SAT, hm(8), hm(11)]]],

    ["Josefa Llanes Escoda", "Professor", "CAS", "AB", "118", "Ground floor", "jlescoda@campus.edu.ph", "local 402",
      "Philippine History, Rizal Course",
      "",
      [[MON, hm(10), hm(12)], [WED, hm(10), hm(12)], [FRI, hm(10), hm(11)]]],

    ["Gabriela Silang", "Associate Professor", "CAS", "AB", "127", "Ground floor", "gsilang@campus.edu.ph", "local 407",
      "Purposive Communication, Creative Writing",
      "I hold consultations in the Reading Room when my office is being shared.",
      [[TUE, hm(13), hm(15)], [THU, hm(13), hm(15)]]],

    ["Apolinario Mabini Jr.", "Assistant Professor", "CAS", "AB", "204", "2nd floor", "amabinijr@campus.edu.ph", "local 410",
      "Ethics, Philosophy of the Human Person",
      "",
      [[WED, hm(14), hm(16)]]],

    ["Melchora Aquino", "Professor", "MATH", "SCI", "305", "3rd floor", "maquino@campus.edu.ph", "local 508",
      "Calculus 1, Calculus 2, Differential Equations",
      "Bring your problem set so we can work through the actual sticking point.",
      [[MON, hm(14), hm(16)], [TUE, hm(8), hm(10)], [THU, hm(8), hm(10)]]],

    ["Antonio Luna", "Associate Professor", "MATH", "SCI", "310", "3rd floor", "aluna@campus.edu.ph", "local 512",
      "Linear Algebra, Discrete Mathematics",
      "",
      [[MON, hm(11), hm(12)], [WED, hm(11), hm(12)], [FRI, hm(11), hm(12)]]],

    ["Trinidad Tecson", "Instructor", "MATH", "SCI", "312", "3rd floor", "ttecson@campus.edu.ph", "local 514",
      "Statistics, Probability",
      "",
      []],

    ["Marcelo del Pilar", "Professor", "CBA", "ADM", "215", "2nd floor", "mdelpilar@campus.edu.ph", "local 604",
      "Financial Accounting, Managerial Accounting",
      "",
      [[TUE, hm(15), hm(17)], [THU, hm(15), hm(17)]]],

    ["Teresa Magbanua", "Associate Professor", "CBA", "ADM", "220", "2nd floor", "tmagbanua@campus.edu.ph", "local 608",
      "Marketing Management, Entrepreneurship",
      "",
      [[MON, hm(9), hm(11)], [WED, hm(9), hm(11)]]],

    ["Francisco Balagtas", "Assistant Professor", "CTE", "AB", "233", "2nd floor", "fbalagtas@campus.edu.ph", "local 415",
      "Curriculum Development, Assessment of Learning",
      "Practice-teaching students: please book a slot by email first.",
      [[TUE, hm(11), hm(12)], [THU, hm(11), hm(12)], [FRI, hm(14), hm(16)]]],
  ];

  const facultyId = {};
  {
    const insertFaculty = db.prepare(
      `INSERT INTO faculty (full_name, title, department_id, building_id, room, floor,
                            email, phone, subjects, consultation_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertHour = db.prepare(
      `INSERT INTO office_hours (faculty_id, weekday, start_minute, end_minute, location_note)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const row of faculty) {
      const [name, title, dept, bldg, room, floor, email, phone, subjects, note, hours] = row;
      const id = Number(
        insertFaculty
          .run(name, title, deptId[dept], buildingId[bldg], room, floor, email, phone, subjects, note)
          .lastInsertRowid,
      );
      facultyId[name] = id;
      for (const [weekday, start, end, locationNote] of hours) {
        insertHour.run(id, weekday, start, end, locationNote ?? "");
      }
    }
  }

  // Two voluntarily-posted statuses, so all three badge states are visible on a
  // fresh install. A posted status is the ONLY way FIND ever learns where someone
  // is; nothing here is inferred or tracked.
  db.prepare(
    `UPDATE faculty SET manual_status = 'available', manual_note = ?,
            manual_until = ?, manual_set_at = datetime('now') WHERE id = ?`,
  ).run(
    "In my office grading. Drop by anytime this afternoon.",
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    facultyId["Andres Bonifacio Cruz"],
  );
  db.prepare(
    `UPDATE faculty SET manual_status = 'unavailable', manual_note = ?,
            manual_until = ?, manual_set_at = datetime('now') WHERE id = ?`,
  ).run(
    "Out for an accreditation meeting all day. Please email me instead.",
    new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    facultyId["Liwayway Dimaculangan"],
  );

  // --- Accounts ---------------------------------------------------------------
  const users = [
    ["admin@campus.edu.ph", "admin1234", "admin", null, "Department Admin"],
    ["jsantos@campus.edu.ph", "faculty1234", "faculty", facultyId["Juan Santos"], "Juan Santos"],
    ["mcreyes@campus.edu.ph", "faculty1234", "faculty", facultyId["Maria Clara Reyes"], "Maria Clara Reyes"],
  ];
  {
    const insert = db.prepare(
      "INSERT INTO users (email, password_hash, role, faculty_id, display_name) VALUES (?, ?, ?, ?, ?)",
    );
    for (const [email, pw, role, fid, name] of users) insert.run(email, hash(pw), role, fid, name);
  }

  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return {
    buildings: count("buildings"),
    departments: count("departments"),
    faculty: count("faculty"),
    office_hours: count("office_hours"),
    users: count("users"),
  };
}
