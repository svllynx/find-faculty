import { getDb, rows } from "@/lib/db";
import { ok, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit — admin only. The change history a department uses to check
 * that directory information is being kept accurate.
 */
export async function GET(request: Request) {
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

  const entries = rows(
    getDb()
      .prepare(
        `SELECT a.id, a.actor_email, a.action, a.faculty_id, a.detail, a.created_at,
                f.full_name AS faculty_name
           FROM audit_log a LEFT JOIN faculty f ON f.id = a.faculty_id
          ORDER BY a.id DESC LIMIT ?`,
      )
      .all(limit),
  );

  return ok({ entries });
}
