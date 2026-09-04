import { getDb } from "@/lib/db";
import { listDepartments } from "@/lib/faculty";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/departments — for the search filter menu and the admin form. */
export async function GET() {
  return ok({ departments: listDepartments(getDb()) });
}
