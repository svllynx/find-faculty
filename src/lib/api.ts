import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { currentUser, type Role, type SessionUser } from "./auth";

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
  const weekdayRaw = url.searchParams.get("day");
  const weekday = weekdayRaw === null ? undefined : Number(weekdayRaw);

  return {
    q: url.searchParams.get("q") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    building: url.searchParams.get("building") ?? undefined,
    weekday: Number.isInteger(weekday) && weekday! >= 0 && weekday! <= 6 ? weekday : undefined,
    openNow: url.searchParams.get("openNow") === "1",
  };
}

/**
 * What a student's browser is allowed to see about a faculty member.
 * Deliberately excludes the audit trail and anything about accounts.
 */
export function publicFaculty(record: {
  id: number;
  full_name: string;
  title: string;
  department_name: string | null;
  department_code: string | null;
  building_name: string | null;
  building_code: string | null;
  building_landmark: string | null;
  building_entrance: string | null;
  room: string;
  floor: string;
  email: string;
  phone: string;
  subjectList: string[];
  consultation_note: string;
  officeLabel: string;
  officeHours: unknown[];
  availability: unknown;
  updated_at: string;
}) {
  return {
    id: record.id,
    name: record.full_name,
    title: record.title,
    department: record.department_name,
    departmentCode: record.department_code,
    office: {
      building: record.building_name,
      buildingCode: record.building_code,
      room: record.room,
      floor: record.floor,
      label: record.officeLabel,
      landmark: record.building_landmark,
      entrance: record.building_entrance,
    },
    contact: { email: record.email, phone: record.phone },
    subjects: record.subjectList,
    consultationNote: record.consultation_note,
    officeHours: record.officeHours,
    availability: record.availability,
    updatedAt: record.updated_at,
  };
}
