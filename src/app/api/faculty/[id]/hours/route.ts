import { getDb } from "@/lib/db";
import { getFaculty } from "@/lib/faculty";
import { officeHoursSchema, replaceOfficeHours } from "@/lib/mutations";
import { canEditFaculty, currentUser } from "@/lib/auth";
import { fail, ok, parseId, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/faculty/:id/hours — replace the whole weekly schedule.
 *
 * Replace-the-set rather than add/remove per row: the editor sends the schedule
 * it is showing, so what the faculty member sees is exactly what gets stored,
 * and overlapping blocks can be rejected as a whole.
 *
 * Body: [{ weekday, start_minute, end_minute, location_note? }, ...]
 */
export async function PUT(request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  const user = await currentUser();
  if (!user) return fail(401, "Sign in to change office hours.");
  if (!canEditFaculty(user, id)) return fail(403, "You can only edit your own office hours.");

  const db = getDb();
  if (!getFaculty(db, id)) return fail(404, "No such faculty member.");

  const body = await readBody(request, officeHoursSchema);
  if ("response" in body) return body.response;

  replaceOfficeHours(db, id, body.data, user);
  const updated = getFaculty(db, id)!;

  return ok({
    officeHours: updated.officeHours,
    availability: updated.availability,
  });
}
