import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  getFaculty,
  listBuildings,
  listDepartments,
  openNowCount,
  searchFaculty,
} from "../lib/faculty";
import { MONDAY_10AM, MONDAY_2PM, seedTestDb } from "./fixtures";

let db: DatabaseSync;
beforeEach(() => {
  db = seedTestDb();
});

const names = (rows: { full_name: string }[]) => rows.map((r) => r.full_name);
const countFaculty = (d: DatabaseSync) =>
  Number((d.prepare("SELECT COUNT(*) AS n FROM faculty").get() as { n: number }).n);

describe("searchFaculty - one box, many kinds of memory", () => {
  it("returns everyone when the query is empty", () => {
    expect(searchFaculty(db, {}, MONDAY_2PM)).toHaveLength(3);
  });

  it("finds a professor by partial name, case-insensitively", () => {
    expect(names(searchFaculty(db, { q: "santos" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(names(searchFaculty(db, { q: "JUAN" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
  });

  it("finds by subject when the student only remembers the course", () => {
    expect(names(searchFaculty(db, { q: "Calculus" }, MONDAY_2PM))).toEqual(["Melchora Aquino"]);
  });

  it("finds by department name and by department code", () => {
    expect(names(searchFaculty(db, { q: "Computer Studies" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(names(searchFaculty(db, { q: "MATH" }, MONDAY_2PM))).toEqual([
      "Melchora Aquino",
      "Trinidad Tecson",
    ]);
  });

  it("finds by building and by room number", () => {
    expect(names(searchFaculty(db, { q: "Science" }, MONDAY_2PM))).toEqual([
      "Melchora Aquino",
      "Trinidad Tecson",
    ]);
    expect(names(searchFaculty(db, { q: "204" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
  });

  it("finds by academic title", () => {
    expect(names(searchFaculty(db, { q: "Instructor" }, MONDAY_2PM))).toEqual(["Trinidad Tecson"]);
  });

  it("returns an empty list rather than throwing on no match", () => {
    expect(searchFaculty(db, { q: "Professor Nonexistent" }, MONDAY_2PM)).toEqual([]);
  });

  it("sorts results by name so the list is stable between loads", () => {
    expect(names(searchFaculty(db, { q: "e" }, MONDAY_2PM))).toEqual([
      "Juan Santos",
      "Melchora Aquino",
      "Trinidad Tecson",
    ]);
  });
});

describe("searchFaculty - SQL safety", () => {
  it("treats a quote and a statement terminator as plain text", () => {
    const hostile = String.fromCharCode(39) + "; DROP TABLE faculty; --";
    expect(() => searchFaculty(db, { q: hostile }, MONDAY_2PM)).not.toThrow();
    expect(searchFaculty(db, { q: hostile }, MONDAY_2PM)).toEqual([]);
    expect(countFaculty(db)).toBe(3);
  });

  it("treats LIKE wildcards as literal characters", () => {
    // A bare percent sign must not match everyone.
    expect(searchFaculty(db, { q: "%" }, MONDAY_2PM)).toEqual([]);
    expect(searchFaculty(db, { q: "_" }, MONDAY_2PM)).toEqual([]);
  });
});

describe("searchFaculty - filters", () => {
  it("filters by department code", () => {
    expect(names(searchFaculty(db, { department: "CCS" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
  });

  it("filters by building code", () => {
    expect(searchFaculty(db, { building: "SCI" }, MONDAY_2PM)).toHaveLength(2);
  });

  it("filters by the weekday a student is free", () => {
    expect(names(searchFaculty(db, { weekday: 3 }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(searchFaculty(db, { weekday: 6 }, MONDAY_2PM)).toEqual([]);
  });

  it("combines a query with a filter", () => {
    expect(searchFaculty(db, { q: "Professor", department: "MATH" }, MONDAY_2PM)).toHaveLength(1);
  });

  it("openNow returns only people a student could walk to right now", () => {
    expect(names(searchFaculty(db, { openNow: true }, MONDAY_2PM))).toEqual([
      "Juan Santos",
      "Melchora Aquino",
    ]);
    expect(searchFaculty(db, { openNow: true }, MONDAY_10AM)).toEqual([]);
    expect(openNowCount(db, MONDAY_2PM)).toBe(2);
  });

  it("hides archived faculty from students but keeps them for admin listings", () => {
    db.prepare("UPDATE faculty SET is_active = 0 WHERE id = 1").run();
    expect(names(searchFaculty(db, {}, MONDAY_2PM))).not.toContain("Juan Santos");
    expect(names(searchFaculty(db, { includeInactive: true }, MONDAY_2PM))).toContain("Juan Santos");
  });
});

describe("getFaculty", () => {
  it("hydrates office, hours, subjects and availability in one read", () => {
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.full_name).toBe("Juan Santos");
    expect(santos.building_name).toBe("Faculty Building");
    expect(santos.department_name).toBe("College of Computer Studies");
    expect(santos.officeLabel).toBe("Faculty Building — Room 204");
    expect(santos.subjectList).toEqual(["Data Structures", "Algorithms"]);
    expect(santos.officeHours).toHaveLength(2);
    expect(santos.availability.state).toBe("office_hours");
    expect(santos.building_entrance).toContain("Main entrance");
  });

  it("carries a per-block location note through to the profile", () => {
    const aquino = getFaculty(db, 2, MONDAY_2PM)!;
    expect(aquino.officeHours[0].location_note).toBe("Math Learning Centre");
  });

  it("says so plainly when someone has published no hours", () => {
    const tecson = getFaculty(db, 3, MONDAY_2PM)!;
    expect(tecson.officeHours).toEqual([]);
    expect(tecson.availability.state).toBe("no_schedule");
  });

  it("returns null for an unknown id", () => {
    expect(getFaculty(db, 9999, MONDAY_2PM)).toBeNull();
  });
});

describe("reference data", () => {
  it("lists buildings and departments for the filter menus", () => {
    expect(listBuildings(db).map((b) => b.code)).toEqual(["FB", "SCI"]);
    const depts = listDepartments(db);
    expect(depts.map((d) => d.code)).toEqual(["CCS", "MATH"]);
    expect(depts[0].building_name).toBe("Faculty Building");
  });
});

describe("row shape", () => {
  // node:sqlite hands back null-prototype objects, which React refuses to send
  // from a Server Component to a Client Component. Every query must normalise.
  it("returns plain objects React can serialise to client components", () => {
    const record = getFaculty(db, 1, MONDAY_2PM)!;
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(record.officeHours[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(listBuildings(db)[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(listDepartments(db)[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(searchFaculty(db, {}, MONDAY_2PM)[0])).toBe(Object.prototype);
    expect(() => JSON.parse(JSON.stringify(record))).not.toThrow();
  });
});
