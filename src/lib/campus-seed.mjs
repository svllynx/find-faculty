/**
 * The demo data: the CCIS building, its 1st-floor rooms, the three CCIS
 * departments, 15 faculty with real office-hour blocks, and the accounts listed
 * in the README.
 *
 * Lives here (not in scripts/) so two callers share one copy: the `npm run
 * seed` CLI, and the deployed app when it boots onto an empty database -- which
 * is what happens on a serverless host, where the only writable directory is
 * /tmp and every cold start begins with nothing.
 *
 * Re-running is safe: the data tables are cleared first, AUTOINCREMENT counters
 * included, so ids are identical on every seed and demo links keep working.
 */
import { randomBytes, scryptSync } from "node:crypto";

const hm = (h, m = 0) => h * 60 + m;
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;

/**
 * Floor-plan geometry, in the 200x104 space the FloorMap component draws in.
 *
 * Six rooms along the top, a corridor across the middle, six along the bottom.
 * The stairs, corridor and entrance are structure and are drawn by the
 * component; only numbered rooms are rows, because only rooms hold people.
 */
const ROOM_W = 26;
const ROOM_H = 35;
const TOP_Y = 8;
const BOTTOM_Y = 61;
const COLUMN_X = [6, 34, 62, 90, 118, 146];

/** [number, name, kind, row] -- row 0 is the top side of the corridor. */
const FLOOR_1 = [
  ["1", "CCIS Faculty Office", "office", 0],
  ["2", "Faculty Room 2", "office", 0],
  ["3", "Computer Laboratory 1", "lab", 0],
  ["4", "Computer Laboratory 2", "lab", 0],
  ["5", "Faculty Room 3", "office", 0],
  ["6", "Lecture Room 6", "lecture", 0],
  ["7", "Faculty Room 4", "office", 1],
  ["8", "Office of the Dean", "office", 1],
  ["9", "Faculty Room 5", "office", 1],
  ["10", "Networking Laboratory", "lab", 1],
  ["11", "Lecture Room 11", "lecture", 1],
  ["12", "Research & Extension Room", "office", 1],
];

const ROOM_NOTES = {
  "1": "First door on your left as you enter the corridor.",
  "6": "At the far end of the corridor, beside the stairs.",
  "8": "Directly across the corridor from Room 2.",
  "12": "At the far end of the corridor, beside the restrooms.",
};

/**
 * [name, title, department, room number (null = not assigned yet), email,
 *  phone, subjects, consultation note, office-hour blocks]
 */
const FACULTY = [
  // --- Computer Science ---
  ["Juan Santos", "Associate Professor", "CS", "1", "jsantos@campus.edu.ph", "local 214",
    "Data Structures, Design and Analysis of Algorithms, CS Thesis 1",
    "Walk-ins welcome during office hours. For thesis consultations, please bring your latest draft.",
    [[MON, hm(13), hm(15)], [WED, hm(13), hm(15)], [FRI, hm(9), hm(11)]]],

  ["Maria Clara Reyes", "Professor", "CS", "1", "mcreyes@campus.edu.ph", "local 216",
    "Automata Theory and Formal Languages, Compiler Design",
    "Email me a short agenda first so we can use the time well.",
    [[TUE, hm(10), hm(12)], [THU, hm(10), hm(12)]]],

  ["Melchora Aquino", "Professor", "CS", "5", "maquino@campus.edu.ph", "local 508",
    "Discrete Mathematics, Numerical Methods",
    "Bring your problem set so we can work through the actual sticking point.",
    [[MON, hm(14), hm(16)], [TUE, hm(8), hm(10)], [THU, hm(8), hm(10)]]],

  ["Antonio Luna", "Associate Professor", "CS", "5", "aluna@campus.edu.ph", "local 512",
    "Artificial Intelligence, Machine Learning, Data Science",
    "",
    [[MON, hm(11), hm(12)], [WED, hm(11), hm(12)], [FRI, hm(11), hm(12)]]],

  ["Liwayway Dimaculangan", "Department Chair", "CS", "8", "ldimaculangan@campus.edu.ph", "local 210",
    "CS Capstone Project, Research Methods in Computing",
    "Chair duties often pull me out. Check my posted status before walking over.",
    [[TUE, hm(14), hm(16)], [THU, hm(14), hm(16)]]],

  // --- Information Technology ---
  ["Andres Bonifacio Cruz", "Assistant Professor", "IT", "2", "abcruz@campus.edu.ph", "local 219",
    "Web Systems and Technologies, Database Management Systems",
    "",
    [[MON, hm(8), hm(10)], [WED, hm(15), hm(17)], [FRI, hm(15), hm(17)]]],

  ["Corazon Villanueva", "Associate Professor", "IT", "10", "cvillanueva@campus.edu.ph", "local 312",
    "Data Communications, Network Administration, Cloud Computing",
    "Lab consultations happen in the Networking Laboratory, not my desk. See the note on each block.",
    [[WED, hm(10), hm(12), "Networking Laboratory, Room 10"], [FRI, hm(13), hm(15)]]],

  ["Emilio Aguinaldo Torres", "Instructor", "IT", "2", "eatorres@campus.edu.ph", "local 308",
    "Human-Computer Interaction, Mobile Application Development",
    "",
    [[SAT, hm(8), hm(11)]]],

  ["Gabriela Silang", "Associate Professor", "IT", "7", "gsilang@campus.edu.ph", "local 407",
    "Information Assurance and Security, Digital Forensics",
    "I hold consultations in the CCIS Faculty Office when Room 7 is being shared.",
    [[TUE, hm(13), hm(15)], [THU, hm(13), hm(15)]]],

  ["Teresa Magbanua", "Associate Professor", "IT", "7", "tmagbanua@campus.edu.ph", "local 608",
    "Systems Integration and Architecture, IT Service Management",
    "",
    [[MON, hm(9), hm(11)], [WED, hm(9), hm(11)]]],

  // --- Information Systems ---
  ["Marcelo del Pilar", "Professor", "IS", "9", "mdelpilar@campus.edu.ph", "local 604",
    "Enterprise Systems, IT Governance and Compliance",
    "",
    [[TUE, hm(15), hm(17)], [THU, hm(15), hm(17)]]],

  ["Josefa Llanes Escoda", "Professor", "IS", "9", "jlescoda@campus.edu.ph", "local 402",
    "Systems Analysis and Design, Business Process Management",
    "",
    [[MON, hm(10), hm(12)], [WED, hm(10), hm(12)], [FRI, hm(10), hm(11)]]],

  ["Francisco Balagtas", "Assistant Professor", "IS", "12", "fbalagtas@campus.edu.ph", "local 415",
    "IS Project Management, Software Quality Assurance",
    "Capstone groups: please book a slot by email before coming as a team.",
    [[TUE, hm(11), hm(12)], [THU, hm(11), hm(12)], [FRI, hm(14), hm(16)]]],

  ["Trinidad Tecson", "Instructor", "IS", "12", "ttecson@campus.edu.ph", "local 514",
    "Professional Issues in Information Systems, Technical Writing",
    "",
    []],

  // Deliberately has no room yet -- the directory has to read sensibly before a
  // department has finished assigning offices.
  ["Apolinario Mabini Jr.", "Assistant Professor", "IS", null, "amabinijr@campus.edu.ph", "local 410",
    "Technopreneurship, Social Issues and Professional Practice",
    "",
    [[WED, hm(14), hm(16)]]],
];

/** @param {import("node:sqlite").DatabaseSync} db */
export function seedCampus(db) {
  const hash = (pw) => {
    const salt = randomBytes(16);
    return `${salt.toString("hex")}:${scryptSync(pw, salt, 64).toString("hex")}`;
  };

  db.exec("PRAGMA foreign_keys = ON");
  const tables = [
    "audit_log",
    "sessions",
    "office_hours",
    "users",
    "faculty",
    "rooms",
    "departments",
    "buildings",
  ];
  for (const table of tables) db.exec(`DELETE FROM ${table}`);
  // Reset the AUTOINCREMENT counters too, so ids are identical on every re-seed
  // and the demo links / smoke test stay valid.
  for (const table of tables) {
    db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
  }

  // --- Building ------------------------------------------------------------
  const buildingId = Number(
    db
      .prepare(
        "INSERT INTO buildings (code, name, landmark, entrance, floors) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "CCIS",
        "CCIS Building",
        "Beside the Engineering Hall, facing the main quadrangle",
        "Use the main entrance on the quadrangle side; the corridor starts right past the lobby",
        1,
      ).lastInsertRowid,
  );

  // --- Departments (all inside CCIS) ---------------------------------------
  const departments = [
    ["CS", "Computer Science", "1"],
    ["IT", "Information Technology", "1"],
    ["IS", "Information Systems", "1"],
  ];
  const deptId = {};
  {
    const insert = db.prepare(
      `INSERT INTO departments (code, name, college_code, college_name, building_id, office)
       VALUES (?, ?, 'CCIS', 'College of Computer Science', ?, ?)`,
    );
    for (const [code, name, office] of departments) {
      deptId[code] = Number(insert.run(code, name, buildingId, `Room ${office}`).lastInsertRowid);
    }
  }

  // --- Rooms on the 1st floor ----------------------------------------------
  const roomId = {};
  {
    const insert = db.prepare(
      `INSERT INTO rooms (building_id, floor, number, name, kind, map_x, map_y, map_w, map_h, note)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [number, name, kind, side] of FLOOR_1) {
      const column = COLUMN_X[FLOOR_1.filter((r) => r[3] === side).findIndex((r) => r[0] === number)];
      const y = side === 0 ? TOP_Y : BOTTOM_Y;
      roomId[number] = Number(
        insert.run(
          buildingId,
          number,
          name,
          kind,
          column,
          y,
          ROOM_W,
          ROOM_H,
          ROOM_NOTES[number] ?? "",
        ).lastInsertRowid,
      );
    }
  }

  // --- Faculty --------------------------------------------------------------
  const facultyId = {};
  {
    const insertFaculty = db.prepare(
      `INSERT INTO faculty (full_name, title, department_id, room_id, email, phone,
                            subjects, consultation_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertHour = db.prepare(
      `INSERT INTO office_hours (faculty_id, weekday, start_minute, end_minute, location_note)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const row of FACULTY) {
      const [name, title, dept, room, email, phone, subjects, note, hours] = row;
      const id = Number(
        insertFaculty
          .run(name, title, deptId[dept], room ? roomId[room] : null, email, phone, subjects, note)
          .lastInsertRowid,
      );
      facultyId[name] = id;
      for (const [weekday, start, end, locationNote] of hours) {
        insertHour.run(id, weekday, start, end, locationNote ?? "");
      }
    }
  }

  // Two voluntarily-posted statuses, so both the short "I am in right now" case
  // and the long "away for a week" override are visible on a fresh install.
  // A posted status is the ONLY way FIND ever learns where someone is.
  const postStatus = db.prepare(
    `UPDATE faculty SET manual_status = ?, manual_note = ?, manual_until = ?,
            manual_set_at = datetime('now') WHERE id = ?`,
  );
  postStatus.run(
    "available",
    "In my office grading. Drop by anytime this afternoon.",
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    facultyId["Andres Bonifacio Cruz"],
  );
  postStatus.run(
    "unavailable",
    "Attending the CHED accreditation visit. Please email me or leave a note at Room 1.",
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    facultyId["Liwayway Dimaculangan"],
  );

  // --- Accounts ------------------------------------------------------------
  const users = [
    ["admin@campus.edu.ph", "admin1234", "admin", null, "CCIS Department Admin"],
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
    rooms: count("rooms"),
    faculty: count("faculty"),
    office_hours: count("office_hours"),
    users: count("users"),
  };
}
