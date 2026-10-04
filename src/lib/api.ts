import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { currentUser, type Role, type SessionUser } from "./auth";
import type { FacultyRecord } from "./faculty";
import { parseScheduleType } from "./availability";

/** Shared plumbing for the /api routes: JSON shapes, guards, error mapping. */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Require a signed-in maintainer. Returns either the user or the response to
 * send back, so route handlers stay linear:
 *
 *   const auth = await requireUser();
 *   if ("response" in auth) return auth.response;
 */
export async function requireUser(
  role?: Role,
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await currentUser();
  if (!user) return { response: fail(401, "Sign in to change faculty information.") };
  if (role && user.role !== role) {
    return { response: fail(403, "Your account does not have permission to do that.") };
  }
  return { user };
}

/** Parse a JSON body against a schema, turning validation errors into 422s. */
export async function readBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ data: output<S> } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: fail(400, "Expected a JSON body.") };
  }
  try {
    return { data: schema.parse(raw) };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        response: fail(422, "Some fields need fixing.", {
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        }),
      };
    }
    throw err;
  }
}

/** Parse a route param that must be a positive integer id. */
export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Read search filters off a URL, ignoring anything malformed. */
export function readFilters(url: URL) {
  const int = (name: string, min: number, max: number) => {
    const raw = url.searchParams.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
  };

  const scheduleType = parseScheduleType(url.searchParams.get("type"));

  return {
    q: url.searchParams.get("q") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    floor: int("floor", 0, 99),
    weekday: int("day", 0, 6),
    scheduleType,
    openNow: url.searchParams.get("openNow") === "1",
  };
}

/**
 * What a student's browser is allowed to see about a faculty member.
 * Deliberately excludes the audit trail and anything about accounts.
 */
export function publicFaculty(record: FacultyRecord) {
  return {
    id: record.id,
    name: record.full_name,
    title: record.title,
    photo: record.photo_url || null,
    college: record.college_name,
    collegeCode: record.college_code,
    department: record.department_name,
    departmentCode: record.department_code,
    office: {
      building: record.building_name,
      buildingCode: record.building_code,
      roomId: record.room_id,
      room: record.room_number,
      roomName: record.room_name,
      floor: record.room_floor,
      floorLabel: record.floorLabel,
      label: record.officeLabel,
      landmark: record.building_landmark,
      entrance: record.building_entrance,
      note: record.room_note,
    },
    contact: { email: record.email, phone: record.phone },
    subjects: record.subjectList,
    consultationNote: record.consultation_note,
    officeHours: record.officeHours,
    availability: record.availability,
    updatedAt: record.updated_at,
  };
}
