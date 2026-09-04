import { z } from "zod";
import { getDb } from "@/lib/db";
import { getFaculty } from "@/lib/faculty";
import { setFacultyActive } from "@/lib/mutations";
import { fail, ok, parseId, readBody, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ active: z.boolean() });

/**
 * POST /api/faculty/:id/archive — admin only.
 *
 * Archiving is a soft delete: the row and its audit history stay, the record
 * just stops appearing in student searches. { active: true } restores it.
 */
export async function POST(request: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return fail(400, "Invalid faculty id.");

  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const db = getDb();
  if (!getFaculty(db, id)) return fail(404, "No such faculty member.");

  const body = await readBody(request, schema);
  if ("response" in body) return body.response;

  setFacultyActive(db, id, body.data.active, auth.user);
  return ok({ id, active: body.data.active });
}
