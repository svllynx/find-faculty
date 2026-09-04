import { z } from "zod";
import { cookies } from "next/headers";
import { getDb, row } from "@/lib/db";
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  rateLimit,
  verifyPassword,
} from "@/lib/auth";
import { fail, ok, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/** POST /api/auth/login — faculty and department admins only. */
export async function POST(request: Request) {
  const body = await readBody(request, schema);
  if ("response" in body) return body.response;

  const { email, password } = body.data;

  // Limit by email so one account cannot be brute-forced from many tabs, and by
  // client address so one client cannot spray many accounts.
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${email}`) || !rateLimit(`ip:${client}`, 30)) {
    return fail(429, "Too many sign-in attempts. Please try again in a few minutes.");
  }

  const db = getDb();
  const user = row<{
    id: number;
    email: string;
    password_hash: string;
    role: string;
    display_name: string;
    faculty_id: number | null;
  }>(
    db
      .prepare(
        "SELECT id, email, password_hash, role, display_name, faculty_id FROM users WHERE email = ?",
      )
      .get(email),
  );

  // Same message and shape whether the email or the password was wrong, so the
  // response cannot be used to enumerate accounts.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return fail(401, "Incorrect email or password.");
  }

  const session = createSession(db, Number(user.id));
  (await cookies()).set(SESSION_COOKIE, session.id, cookieOptions(session.expiresAt));

  return ok({
    user: {
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      facultyId: user.faculty_id === null ? null : Number(user.faculty_id),
    },
  });
}
