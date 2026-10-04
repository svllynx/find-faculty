import { getDb } from "@/lib/db";
import { getFaculty } from "@/lib/faculty";
import { listAppointmentsForFaculty } from "@/lib/appointments";
import { createAppointment, createAppointmentSchema } from "@/lib/mutations";
import { canEditFaculty, currentUser, rateLimit } from "@/lib/auth";
import { fail, ok, parseId, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/faculty/:id/appointments — the faculty member's own requests, or an admin's. */
export async function GET(_request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  const user = await currentUser();
  if (!user) return fail(401, "Sign in to view appointment requests.");
  if (!canEditFaculty(user, id)) return fail(403, "You can only view your own requests.");

  const db = getDb();
  if (!getFaculty(db, id)) return fail(404, "No such faculty member.");

  return ok({ appointments: listAppointmentsForFaculty(db, id) });
}

/**
 * POST /api/faculty/:id/appointments — a student requests a meeting.
 *
 * Public: students never sign in. Rate-limited per faculty record so this
 * cannot be used to spam a professor's inbox.
 *
 * Body: { office_hour_id?, student_name, student_email, reason?,
 *         requested_date, weekday, start_minute, end_minute, type }
 */
export async function POST(request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  if (!rateLimit(`appointment:${id}`, 10, 10 * 60 * 1000)) {
    return fail(429, "Too many requests. Please try again in a few minutes.");
  }

  const db = getDb();
  const faculty = getFaculty(db, id);
  if (!faculty || !faculty.is_active) return fail(404, "No such faculty member.");

  const body = await readBody(request, createAppointmentSchema);
  if ("response" in body) return body.response;

  // The slot must actually belong to a block this faculty member currently
  // publishes — a student cannot request a time that was never offered.
  const matches = faculty.officeHours.some(
    (h) =>
      h.weekday === body.data.weekday &&
      h.start_minute <= body.data.start_minute &&
      h.end_minute >= body.data.end_minute &&
      (h.type ?? "office") === body.data.type,
  );
  if (!matches) {
    return fail(422, "That time is no longer part of their published schedule. Please pick another.");
  }

  const appointmentId = createAppointment(db, id, body.data);
  return ok({ id: appointmentId }, { status: 201 });
}
