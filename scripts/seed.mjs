/**
 * Reset the local database to the demo campus.
 *
 *   node scripts/seed.mjs
 *
 * The data itself lives in src/lib/campus-seed.mjs, shared with the app's own
 * boot-time seeding, so there is only ever one copy of the demo campus.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "../src/lib/schema.mjs";
import { seedCampus } from "../src/lib/campus-seed.mjs";

const dbPath = process.env.FIND_DB_PATH ?? path.join(process.cwd(), "data", "find.db");
if (dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(SCHEMA);
const counts = seedCampus(db);
db.close();

console.log(`Seeded ${dbPath}`);
for (const [table, n] of Object.entries(counts)) {
  console.log(`  ${table.padEnd(13)}${n}`);
}
console.log("  accounts     admin@campus.edu.ph / admin1234");
