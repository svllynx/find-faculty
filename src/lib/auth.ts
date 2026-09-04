import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { DatabaseSync } from "node:sqlite";
import { getDb, row } from "./db";
import { hashPassword, verifyPassword } from "./password";

/**
 * Session auth for the people who maintain the data (faculty + department admins).
 * Students never sign in — the directory is public and read-only to them.
 *
 * Passwords: scrypt with a per-user 16-byte salt, stored as "salt:key" hex.
 * Sessions: 256-bit opaque random id in an HttpOnly cookie; the cookie value is
 * the row key, so nothing about the user is trusted from the client side.
 */

export const SESSION_COOKIE = "find_session";
const SESSION_DAYS = 7;

export type Role = "faculty" | "admin";

export type SessionUser = {
  id: number;
  email: string;
  role: Role;
  display_name: string;
  faculty_id: number | null;
};

export { hashPassword, verifyPassword };

function expiryIso(days = SESSION_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function createSession(db: DatabaseSync, userId: number): { id: string; expiresAt: string } {
  const id = randomBytes(32).toString("hex");
  const expiresAt = expiryIso();
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    expiresAt,
  );
  // Opportunistic cleanup so the table cannot grow without bound.
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  return { id, expiresAt };
}

export function userForSession(db: DatabaseSync, sessionId: string | undefined): SessionUser | null {
  if (!sessionId) return null;
  const found = row<SessionUser & { expires_at: string }>(
    db
      .prepare(
        `SELECT u.id, u.email, u.role, u.display_name, u.faculty_id, s.expires_at
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ?`,
      )
      .get(sessionId),
  );

  if (!found) return null;
  if (new Date(found.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }
  return {
    id: Number(found.id),
    email: found.email,
    role: found.role as Role,
    display_name: found.display_name,
    faculty_id: found.faculty_id === null ? null : Number(found.faculty_id),
  };
}

export function destroySession(db: DatabaseSync, sessionId: string | undefined): void {
  if (!sessionId) return;
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/** Read the signed-in user from the request cookies. Server-side only. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userForSession(getDb(), jar.get(SESSION_COOKIE)?.value);
}

/** May this user edit this faculty record? Admins: any. Faculty: only their own. */
export function canEditFaculty(user: SessionUser | null, facultyId: number): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.faculty_id === facultyId;
}

export function cookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  };
}

/**
 * Very small fixed-window limiter for the login endpoint. Per-process, which is
 * the right scope for a single-instance campus deployment.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();

  // Drop expired windows so a stream of distinct keys cannot grow the map
  // without bound. Cheap at this size, and only when the map is worth sweeping.
  if (attempts.size > 256) {
    for (const [existing, entry] of attempts) {
      if (entry.resetAt < now) attempts.delete(existing);
    }
  }

  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function auditLog(
  db: DatabaseSync,
  actor: SessionUser | null,
  action: string,
  facultyId: number | null,
  detail = "",
): void {
  db.prepare(
    "INSERT INTO audit_log (user_id, actor_email, action, faculty_id, detail) VALUES (?, ?, ?, ?, ?)",
  ).run(actor?.id ?? null, actor?.email ?? "system", action, facultyId, detail);
}
