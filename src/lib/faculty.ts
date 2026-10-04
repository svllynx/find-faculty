import type { DatabaseSync } from "node:sqlite";
import { rows, row } from "./db";
import {
  resolveAvailability,
  isOpenNow,
  type Availability,
  type OfficeHour,
  type ScheduleType,
} from "./availability";

/**
 * Read/query layer. Every query is parameterized — search text is never
 * concatenated into SQL.
 *
 * A faculty member's office is a room row, not free text, so the directory and
 * the floor plan are always describing the same place.
 */

export type Building = {
  id: number;
  code: string;
  name: string;
  landmark: string;
  entrance: string;
  floors: number;
};

export type Department = {
  id: number;
  code: string;
  name: string;
  college_code: string;
  college_name: string;
  office: string;
  building_id: number | null;
  building_name: string | null;
  building_code: string | null;
};

export type Room = {
  id: number;
  building_id: number;
  floor: number;
  number: string;
  name: string;
  kind: "office" | "lab" | "lecture" | "facility";
  map_x: number;
  map_y: number;
  map_w: number;
  map_h: number;
  note: string;
};

export type RoomWithOccupants = Room & { occupants: number };

export type FacultyRow = {
  id: number;
  full_name: string;
  title: string;
  photo_url: string;
  email: string;
  phone: string;
  subjects: string;
  consultation_note: string;
  manual_status: string | null;
  manual_note: string | null;
  manual_until: string | null;
  manual_set_at: string | null;
  is_active: number;
  updated_at: string;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
  college_code: string | null;
  college_name: string | null;
  room_id: number | null;
  room_number: string | null;
  room_name: string | null;
  room_kind: string | null;
  room_floor: number | null;
  room_note: string | null;
  building_id: number | null;
  building_name: string | null;
  building_code: string | null;
  building_landmark: string | null;
  building_entrance: string | null;
};

export type FacultyRecord = Omit<FacultyRow, "is_active"> & {
  is_active: boolean;
  subjectList: string[];
  officeHours: OfficeHour[];
  availability: Availability;
  /** "CCIS Building — Room 1", or a plain statement that no office is assigned. */
  officeLabel: string;
  /** "1st floor", or "" when there is no room yet. */
  floorLabel: string;
};

export type SearchFilters = {
  q?: string;
  department?: string; // department code (CS / IT / IS)
  floor?: number; // only faculty whose office is on this floor
  weekday?: number; // only faculty with hours on this weekday
  scheduleType?: ScheduleType; // only faculty with a block of this kind
  openNow?: boolean; // only faculty a student could visit right now
  includeInactive?: boolean;
};

const SELECT_FACULTY = `
  SELECT f.id, f.full_name, f.title, f.photo_url, f.email, f.phone, f.subjects,
         f.consultation_note, f.manual_status, f.manual_note, f.manual_until,
         f.manual_set_at, f.is_active, f.updated_at,
         f.department_id, d.name AS department_name, d.code AS department_code,
         d.college_code, d.college_name,
         f.room_id, r.number AS room_number, r.name AS room_name, r.kind AS room_kind,
         r.floor AS room_floor, r.note AS room_note,
         b.id AS building_id, b.name AS building_name, b.code AS building_code,
         b.landmark AS building_landmark, b.entrance AS building_entrance
    FROM faculty f
    LEFT JOIN departments d ON d.id = f.department_id
    LEFT JOIN rooms       r ON r.id = f.room_id
    LEFT JOIN buildings   b ON b.id = r.building_id
`;

/** "1st floor", "2nd floor", "3rd floor", ... */
export function floorLabel(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return "";
  const suffix =
    floor % 100 >= 11 && floor % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[floor % 10] ?? "th";
  return `${floor}${suffix} floor`;
}

function officeLabel(record: FacultyRow): string {
  if (!record.room_number) return "Office not yet assigned";
  const building = record.building_name ? `${record.building_name} — ` : "";
  return `${building}Room ${record.room_number}`;
}

function hydrate(db: DatabaseSync, record: FacultyRow, at: Date): FacultyRecord {
  const officeHours = rows<OfficeHour>(
    db
      .prepare(
        `SELECT weekday, start_minute, end_minute, type, location_note
           FROM office_hours WHERE faculty_id = ?
          ORDER BY weekday, start_minute`,
      )
      .all(record.id),
  );

  return {
    ...record,
    is_active: Boolean(record.is_active),
    subjectList: record.subjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    officeHours,
    availability: resolveAvailability(officeHours, record, at),
    officeLabel: officeLabel(record),
    floorLabel: floorLabel(record.room_floor),
  };
}

export function listBuildings(db: DatabaseSync): Building[] {
  return rows<Building>(
    db.prepare("SELECT id, code, name, landmark, entrance, floors FROM buildings ORDER BY name").all(),
  );
}

/** The single building FIND currently covers, or null before one is set up. */
export function primaryBuilding(db: DatabaseSync): Building | null {
  return row<Building>(
    db.prepare("SELECT id, code, name, landmark, entrance, floors FROM buildings ORDER BY id LIMIT 1").get(),
  );
}

export function listDepartments(db: DatabaseSync): Department[] {
  return rows<Department>(
    db
      .prepare(
        `SELECT d.id, d.code, d.name, d.college_code, d.college_name, d.office, d.building_id,
                b.name AS building_name, b.code AS building_code
           FROM departments d LEFT JOIN buildings b ON b.id = d.building_id
          ORDER BY d.name`,
      )
      .all(),
  );
}

/** Rooms on a floor, in door order, with how many faculty sit in each. */
export function listRooms(db: DatabaseSync, floor?: number): RoomWithOccupants[] {
  const where = floor === undefined ? "" : "WHERE r.floor = ?";
  const params = floor === undefined ? [] : [floor];
  return rows<RoomWithOccupants>(
    db
      .prepare(
        `SELECT r.id, r.building_id, r.floor, r.number, r.name, r.kind,
                r.map_x, r.map_y, r.map_w, r.map_h, r.note,
                (SELECT COUNT(*) FROM faculty f WHERE f.room_id = r.id AND f.is_active = 1) AS occupants
           FROM rooms r ${where}
          ORDER BY r.floor, CAST(r.number AS INTEGER), r.number`,
      )
      .all(...params),
  );
}

/** Which floors have rooms mapped, for the floor switcher and search filter. */
export function listFloors(db: DatabaseSync): number[] {
  return rows<{ floor: number }>(
    db.prepare("SELECT DISTINCT floor FROM rooms ORDER BY floor").all(),
  ).map((r) => Number(r.floor));
}

export function getFaculty(db: DatabaseSync, id: number, at: Date = new Date()): FacultyRecord | null {
  const record = row<FacultyRow>(db.prepare(`${SELECT_FACULTY} WHERE f.id = ?`).get(id));
  return record ? hydrate(db, record, at) : null;
}

/** Everyone whose office is a given room — the floor plan links to this. */
export function facultyInRoom(
  db: DatabaseSync,
  roomId: number,
  at: Date = new Date(),
): FacultyRecord[] {
  const found = rows<FacultyRow>(
    db.prepare(`${SELECT_FACULTY} WHERE f.room_id = ? AND f.is_active = 1 ORDER BY f.full_name`).all(roomId),
  );
  return found.map((record) => hydrate(db, record, at));
}

/** At or under this length, a query is treated as a code rather than free text. */
const SHORT_QUERY = 3;

/** Neutralise LIKE metacharacters in user input. Must escape the escape char first. */
function escapeLike(value: string): string {
  return value.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
}

/**
 * Faculty search. One text box matches name, title, department, subject, room
 * number or room name, because a student may only remember any one of those.
 */
export function searchFaculty(
  db: DatabaseSync,
  filters: SearchFilters = {},
  at: Date = new Date(),
): FacultyRecord[] {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (!filters.includeInactive) where.push("f.is_active = 1");

  const q = filters.q?.trim();
  if (q) {
    // '!' is the LIKE escape character, so a student typing '%' or '_' searches
    // for that literal character instead of matching the whole directory.
    const like = `%${escapeLike(q)}%`;

    if (q.length <= SHORT_QUERY) {
      // A very short query is almost always a code or a room number -- "IT",
      // "CS", "7". Substring-matching those would drag in every subject that
      // merely contains the letters (an "IT" search hitting "Algorithms"), so
      // short queries match codes and room numbers exactly, and names by prefix.
      where.push(`(
           d.code = ? COLLATE NOCASE
        OR b.code = ? COLLATE NOCASE
        OR r.number = ? COLLATE NOCASE
        OR f.full_name LIKE ? ESCAPE '!'
      )`);
      params.push(q, q, q, `${escapeLike(q)}%`);
    } else {
      where.push(`(
           f.full_name LIKE ? ESCAPE '!'
        OR f.title     LIKE ? ESCAPE '!'
        OR f.subjects  LIKE ? ESCAPE '!'
        OR r.number    LIKE ? ESCAPE '!'
        OR r.name      LIKE ? ESCAPE '!'
        OR d.name      LIKE ? ESCAPE '!'
        OR d.code      LIKE ? ESCAPE '!'
        OR b.name      LIKE ? ESCAPE '!'
        OR b.code      LIKE ? ESCAPE '!'
      )`);
      params.push(like, like, like, like, like, like, like, like, like);
    }
  }

  if (filters.department) {
    where.push("d.code = ?");
    params.push(filters.department);
  }
  if (typeof filters.floor === "number") {
    where.push("r.floor = ?");
    params.push(filters.floor);
  }
  if (typeof filters.weekday === "number") {
    where.push("EXISTS (SELECT 1 FROM office_hours oh WHERE oh.faculty_id = f.id AND oh.weekday = ?)");
    params.push(filters.weekday);
  }
  if (filters.scheduleType) {
    where.push("EXISTS (SELECT 1 FROM office_hours oh WHERE oh.faculty_id = f.id AND oh.type = ?)");
    params.push(filters.scheduleType);
  }

  const sql = `${SELECT_FACULTY}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY f.full_name`;

  const found = rows<FacultyRow>(db.prepare(sql).all(...params));
  const records = found.map((record) => hydrate(db, record, at));

  return filters.openNow ? records.filter((r) => isOpenNow(r.availability)) : records;
}

/** Everyone a student could walk up to right now — the home page's "open now" rail. */
export function openNowCount(db: DatabaseSync, at: Date = new Date()): number {
  return searchFaculty(db, { openNow: true }, at).length;
}
