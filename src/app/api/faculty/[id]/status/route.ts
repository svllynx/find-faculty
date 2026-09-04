import { getDb } from "@/lib/db";
import { getFaculty } from "@/lib/faculty";
import { setManualStatus, statusSchema } from "@/lib/mutations";
import { canEditFaculty, currentUser } from "@/lib/auth";
import { fail, ok, parseId, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/faculty/:id/status — post, or clear, a voluntary availability status.
 *
 * This is the ONLY way a status ever reaches FIND. There is no scanning, no
 * device lookup, no inference: a faculty member (or an admin acting for them)
 * says so, or the badge falls back to the published schedule.
 *
 * Body: { manual_status: "available" | "office_hours" | "unavailable" | null,
 *         manual_note?: string, expires_in_minutes?: number | null }
 */
export async function POST(request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  const user = await currentUser();
  if (!user) return fail(401, "Sign in to post your availability.");
  if (!canEditFaculty(user, id)) return fail(403, "You can only post your own availability.");

  const db = getDb();
  if (!getFaculty(db, id)) return fail(404, "No such faculty member.");

  const body = await readBody(request, statusSchema);
  if ("response" in body) return body.response;

  setManualStatus(db, id, body.data, user);

  return ok({ availability: getFaculty(db, id)!.availability });
}
