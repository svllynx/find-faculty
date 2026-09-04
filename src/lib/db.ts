import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCHEMA } from "./schema.mjs";
import { seedCampus } from "./campus-seed.mjs";

/**
 * Single SQLite connection for the whole server process.
 *
 * Uses node:sqlite (built into Node >= 22.5) so FIND has a real relational
 * database with zero native build steps -- it runs on a lab machine as-is.
 */

/**
 * Where the database file lives.
 *
 * On a normal server that is ./data/find.db, and it persists.
 *
 * On a serverless host (Vercel) the deployment is READ-ONLY apart from the
 * system temp directory, and each cold start gets a fresh one. So there we work
 * in /tmp and seed the demo campus on boot. That makes the deployment a working
 * public demo -- searching, signing in, editing, all of it -- but edits live
 * only as long as that instance. Point FIND at a persistent volume or a hosted
 * libSQL/Postgres database before running a real campus on it.
 */
function resolveDbPath(): { file: string; ephemeral: boolean } {
  if (process.env.FIND_DB_PATH) {
    return { file: process.env.FIND_DB_PATH, ephemeral: false };
  }
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (serverless) {
    return { file: path.join(os.tmpdir(), "find.db"), ephemeral: true };
  }
  return { file: path.join(process.cwd(), "data", "find.db"), ephemeral: false };
}

/**
 * True when this process is working against a throwaway database, so the UI can
 * say so instead of implying edits are permanent.
 */
export function usingEphemeralDb(): boolean {
  return resolveDbPath().ephemeral;
}

let instance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (instance) return instance;

  const { file } = resolveDbPath();

  if (file !== ":memory:") {
    mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);
  db.exec(SCHEMA);

  // An empty database is only ever the result of a fresh start, so fill it with
  // the demo campus rather than serving an empty directory. Opt out with
  // FIND_AUTOSEED=0 when pointing FIND at a real, intentionally empty database.
  const empty = Number((db.prepare("SELECT COUNT(*) AS n FROM faculty").get() as { n: number }).n) === 0;
  if (empty && process.env.FIND_AUTOSEED !== "0") {
    seedCampus(db);
  }

  instance = db;
  return db;
}

/** Test helper: an isolated in-memory database with the schema applied. */
export function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

/** Run a set of statements atomically. Rolls back on any throw. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * node:sqlite returns rows with a null prototype. React cannot serialise those
 * across the server/client boundary, and spreading them is cheap, so every
 * query goes through these two helpers rather than remembering case by case.
 */
export function rows<T>(result: unknown[]): T[] {
  return result.map((r) => ({ ...(r as object) })) as T[];
}

export function row<T>(result: unknown): T | null {
  return result === undefined || result === null ? null : ({ ...(result as object) } as T);
}
