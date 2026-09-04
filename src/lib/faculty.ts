import type { DatabaseSync } from "node:sqlite";
import { rows, row } from "./db";
import { resolveAvailability, isOpenNow, type Availability, type OfficeHour } from "./availability";

/**
 * Read/query layer. Every query is parameterized — search text is never
 * concatenated into SQL.
 */

export type Building = {
  id: number;
  code: string;
  name: string;
  landmark: string;
  entrance: string;
  map_x: number;
  map_y: number;
};

export type Department = {
  id: number;
  code: string;
  name: string;
  office: string;
  building_id: number | null;
  building_name: string | null;
  building_code: string | null;
};

export type FacultyRow = {
  id: number;
  full_name: string;
  title: string;
  room: string;
  floor: string;
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
  building_id: number | null;
  building_name: string | null;
  building_code: string | null;
  building_landmark: string | null;
  building_entrance: string | null;
  building_map_x: number | null;
  building_map_y: number | null;
};

export type FacultyRecord = Omit<FacultyRow, "is_active"> & {
  is_active: boolean;
  subjectList: string[];
  officeHours: OfficeHour[];
  availability: Availability;
  officeLabel: string;
};

export type SearchFilters = {
  q?: string;
  department?: string; // department code
  building?: string; // building code
  weekday?: number; // only faculty with hours on this weekday
  openNow?: boolean; // only faculty a student could visit right now
  includeInactive?: boolean;
};

const SELECT_FACULTY = `
  SELECT f.id, f.full_name, f.title, f.room, f.floor, f.email, f.phone, f.subjects,
         f.consultation_note, f.manual_status, f.manual_note, f.manual_until,
         f.manual_set_at, f.is_active, f.updated_at,
         f.department_id, d.name AS department_name, d.code AS department_code,
         f.building_id,  b.name AS building_name,   b.code AS building_code,
         b.landmark AS building_landmark, b.entrance AS building_entrance,
         b.map_x AS building_map_x, b.map_y AS building_map_y
    FROM faculty f
    LEFT JOIN departments d ON d.id = f.department_id
    LEFT JOIN buildings   b ON b.id = f.building_id
`;

function officeLabel(record: FacultyRow): string {
  const parts: string[] = [];
  if (record.building_name) parts.push(record.building_name);
  if (record.room) parts.push(`Room ${record.room}`);
  if (parts.length === 0) return "Office not yet assigned";
  return parts.join(" — ");
}

function hydrate(db: DatabaseSync, record: FacultyRow, at: Date): FacultyRecord {
  const officeHours = rows<OfficeHour>(
    db
      .prepare(
        `SELECT weekday, start_minute, end_minute, location_note
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
  };
}

export function listBuildings(db: DatabaseSync): Building[] {
  return rows<Building>(
    db
      .prepare("SELECT id, code, name, landmark, entrance, map_x, map_y FROM buildings ORDER BY name")
      .all(),
  );
}

export function listDepartments(db: DatabaseSync): Department[] {
  return rows<Department>(
    db
      .prepare(
        `SELECT d.id, d.code, d.name, d.office, d.building_id,
                b.name AS building_name, b.code AS building_code
           FROM departments d LEFT JOIN buildings b ON b.id = d.building_id
          ORDER BY d.name`,
      )
      .all(),
  );
}

export function getFaculty(db: DatabaseSync, id: number, at: Date = new Date()): FacultyRecord | null {
  const record = row<FacultyRow>(db.prepare(`${SELECT_FACULTY} WHERE f.id = ?`).get(id));
  return record ? hydrate(db, record, at) : null;
}

/** Neutralise LIKE metacharacters in user input. Must escape the escape char first. */
function escapeLike(value: string): string {
  return value
    .replace(/!/g, "!!")
    .replace(/%/g, "!%")
    .replace(/_/g, "!_");
}

/**
 * Faculty search. One text box matches name, title, department, subject,
 * building or room number, because a student may only remember any one of those.
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
    where.push(`(
         f.full_name LIKE ? ESCAPE '!'
      OR f.title     LIKE ? ESCAPE '!'
      OR f.subjects  LIKE ? ESCAPE '!'
      OR f.room      LIKE ? ESCAPE '!'
      OR d.name      LIKE ? ESCAPE '!'
      OR d.code      LIKE ? ESCAPE '!'
      OR b.name      LIKE ? ESCAPE '!'
      OR b.code      LIKE ? ESCAPE '!'
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  if (filters.department) {
    where.push("d.code = ?");
    params.push(filters.department);
  }
  if (filters.building) {
    where.push("b.code = ?");
    params.push(filters.building);
  }
  if (typeof filters.weekday === "number") {
    where.push("EXISTS (SELECT 1 FROM office_hours oh WHERE oh.faculty_id = f.id AND oh.weekday = ?)");
    params.push(filters.weekday);
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
