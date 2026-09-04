import { getDb } from "@/lib/db";
import { searchFaculty } from "@/lib/faculty";
import { createFaculty, createFacultySchema } from "@/lib/mutations";
import { fail, ok, publicFaculty, readBody, readFilters, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/faculty — the student-facing search.
 *   ?q=          name, title, subject, room, department or building
 *   ?department= department code (CCS)
 *   ?building=   building code (FB)
 *   ?day=        0-6, only faculty with hours that weekday
 *   ?openNow=1   only faculty a student could visit right now
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = readFilters(url);
  const results = searchFaculty(getDb(), filters);

  return ok({
    count: results.length,
    filters,
    results: results.map(publicFaculty),
  });
}

/** POST /api/faculty — department admin adds a faculty record. */
export async function POST(request: Request) {
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const body = await readBody(request, createFacultySchema);
  if ("response" in body) return body.response;

  const db = getDb();
  try {
    const id = createFaculty(db, body.data, auth.user);
    return ok({ id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the record.";
    // A bad department_id / building_id trips a foreign key, which is the
    // caller's mistake rather than a server fault.
    if (message.includes("FOREIGN KEY")) {
      return fail(422, "That department or building does not exist.");
    }
    throw err;
  }
}
