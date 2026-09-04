import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { hashPassword, verifyPassword } from "../lib/password";
import { canEditFaculty, createSession, destroySession, rateLimit, userForSession } from "../lib/auth";
import { seedTestDb } from "./fixtures";

let db: DatabaseSync;
beforeEach(() => {
  db = seedTestDb();
});

describe("password hashing", () => {
  it("accepts the correct password and rejects a wrong one", () => {
    const stored = hashPassword("faculty1234");
    expect(verifyPassword("faculty1234", stored)).toBe(true);
    expect(verifyPassword("faculty1235", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("never stores the password itself", () => {
    expect(hashPassword("faculty1234")).not.toContain("faculty1234");
  });

  it("salts, so the same password hashes differently every time", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nosalt")).toBe(false);
    expect(verifyPassword("x", "abc:")).toBe(false);
  });
});

describe("sessions", () => {
  it("resolves a fresh session id to its user", () => {
    const { id } = createSession(db, 2);
    const user = userForSession(db, id);
    expect(user?.email).toBe("jsantos@campus.edu.ph");
    expect(user?.role).toBe("faculty");
    expect(user?.faculty_id).toBe(1);
  });

  it("returns null for a missing, empty or unknown session id", () => {
    expect(userForSession(db, undefined)).toBeNull();
    expect(userForSession(db, "")).toBeNull();
    expect(userForSession(db, "deadbeef")).toBeNull();
  });

  it("issues unpredictable, non-sequential session ids", () => {
    const a = createSession(db, 1).id;
    const b = createSession(db, 1).id;
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects an expired session and cleans the row up", () => {
    const { id } = createSession(db, 1);
    db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(
      new Date(Date.now() - 1000).toISOString(),
      id,
    );
    expect(userForSession(db, id)).toBeNull();
    const remaining = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id = ?").get(id) as {
      n: number;
    };
    expect(Number(remaining.n)).toBe(0);
  });

  it("logging out invalidates the session immediately", () => {
    const { id } = createSession(db, 1);
    destroySession(db, id);
    expect(userForSession(db, id)).toBeNull();
  });

  it("drops sessions when the user account is deleted", () => {
    const { id } = createSession(db, 2);
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare("DELETE FROM users WHERE id = 2").run();
    expect(userForSession(db, id)).toBeNull();
  });
});

describe("canEditFaculty", () => {
  const admin = { id: 1, email: "a", role: "admin" as const, display_name: "", faculty_id: null };
  const santos = {
    id: 2,
    email: "b",
    role: "faculty" as const,
    display_name: "",
    faculty_id: 1,
  };

  it("lets an admin edit any record", () => {
    expect(canEditFaculty(admin, 1)).toBe(true);
    expect(canEditFaculty(admin, 99)).toBe(true);
  });

  it("lets a faculty member edit only their own record", () => {
    expect(canEditFaculty(santos, 1)).toBe(true);
    expect(canEditFaculty(santos, 2)).toBe(false);
  });

  it("denies an anonymous visitor", () => {
    expect(canEditFaculty(null, 1)).toBe(false);
  });

  it("denies a faculty account not yet linked to a record", () => {
    expect(canEditFaculty({ ...santos, faculty_id: null }, 1)).toBe(false);
  });
});

describe("login rate limit", () => {
  it("allows a burst then blocks further attempts for that key", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) expect(rateLimit(key, 3)).toBe(true);
    expect(rateLimit(key, 3)).toBe(false);
  });

  it("tracks each key separately", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1)).toBe(true);
    expect(rateLimit(a, 1)).toBe(false);
    expect(rateLimit(b, 1)).toBe(true);
  });

  it("lets attempts through again after the window elapses", () => {
    const key = `win-${Math.random()}`;
    expect(rateLimit(key, 1, 1)).toBe(true);
    expect(rateLimit(key, 1, 1)).toBe(false);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* wait out the 1 ms window */
    }
    expect(rateLimit(key, 1, 1)).toBe(true);
  });
});
