import { getDb } from "@/lib/db";
import { getFaculty } from "@/lib/faculty";
import { profileSchema, updateFacultyProfile } from "@/lib/mutations";
import { canEditFaculty, currentUser } from "@/lib/auth";
import { fail, ok, parseId, publicFaculty, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/faculty/:id — one professor, with office, hours and availability. */
export async function GET(_request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  const record = getFaculty(getDb(), id);
  if (!record || !record.is_active) return fail(404, "No such faculty member.");

  return ok(publicFaculty(record));
}

/**
 * PATCH /api/faculty/:id — update office location and contact details.
 * A faculty member may edit only their own record; an admin may edit any.
 */
export async function PATCH(request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  const user = await currentUser();
  if (!user) return fail(401, "Sign in to change faculty information.");
  if (!canEditFaculty(user, id)) {
    return fail(403, "You can only update your own faculty record.");
  }

  const db = getDb();
  const existing = getFaculty(db, id);
  if (!existing) return fail(404, "No such faculty member.");

  const body = await readBody(request, profileSchema);
  if ("response" in body) return body.response;

  // Only an admin may rename a record — a name change is a directory-wide
  // decision, not a personal setting.
  if (body.data.full_name && user.role !== "admin" && body.data.full_name !== existing.full_name) {
    return fail(403, "Ask your department admin to change the name on a record.");
  }

  try {
    updateFacultyProfile(db, id, body.data, user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("FOREIGN KEY")) {
      return fail(422, "That department or room does not exist.");
    }
    throw err;
  }

  return ok(publicFaculty(getFaculty(db, id)!));
}
