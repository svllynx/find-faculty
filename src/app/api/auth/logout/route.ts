import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, destroySession } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — drops the session row, then the cookie. */
export async function POST() {
  const jar = await cookies();
  destroySession(getDb(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return ok({ ok: true });
}
