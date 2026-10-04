import { getDb, row } from "@/lib/db";
import { canEditFaculty, currentUser } from "@/lib/auth";
import { respondToAppointment, appointmentResponseSchema } from "@/lib/mutations";
import { fail, ok, parseId, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/appointments/:id/respond — approve, decline, or cancel a request.
 *
 * Body: { status: "approved" | "declined" | "cancelled", faculty_note? }
 */
export async function POST(request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid appointment id.");

  const user = await currentUser();
  if (!user) return fail(401, "Sign in to respond to appointment requests.");

  const db = getDb();
  const appointment = row<{ id: number; faculty_id: number; status: string }>(
    db.prepare("SELECT id, faculty_id, status FROM appointments WHERE id = ?").get(id),
  );
  if (!appointment) return fail(404, "No such appointment request.");
  if (!canEditFaculty(user, appointment.faculty_id)) {
    return fail(403, "You can only respond to your own appointment requests.");
  }

  const body = await readBody(request, appointmentResponseSchema);
  if ("response" in body) return body.response;

  respondToAppointment(db, id, appointment.faculty_id, body.data, user);
  return ok({ status: body.data.status });
}
