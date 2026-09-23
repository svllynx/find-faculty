import { getDb } from "@/lib/db";
import { listFloors, listRooms, primaryBuilding } from "@/lib/faculty";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms[?floor=1] — the floor plan as data.
 *
 * Rooms carry their own map geometry, so anything that can draw a rectangle can
 * render the same floor plan FIND does.
 */
export async function GET(request: Request) {
  const db = getDb();
  const raw = new URL(request.url).searchParams.get("floor");
  const floor = raw === null ? undefined : Number(raw);
  const valid = floor !== undefined && Number.isInteger(floor) ? floor : undefined;

  return ok({
    building: primaryBuilding(db),
    floors: listFloors(db),
    rooms: listRooms(db, valid),
  });
}
