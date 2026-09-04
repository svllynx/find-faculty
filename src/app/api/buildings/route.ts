import { getDb } from "@/lib/db";
import { listBuildings } from "@/lib/faculty";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/buildings — campus buildings with their map coordinates. */
export async function GET() {
  return ok({ buildings: listBuildings(getDb()) });
}
