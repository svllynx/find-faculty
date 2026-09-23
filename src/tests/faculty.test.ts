import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  facultyInRoom,
  floorLabel,
  getFaculty,
  listBuildings,
  listDepartments,
  listFloors,
  listRooms,
  openNowCount,
  primaryBuilding,
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
    expect(names(searchFaculty(db, { q: "Networks" }, MONDAY_2PM))).toEqual(["Melchora Aquino"]);
  });

  it("finds by department name and by department code", () => {
    expect(names(searchFaculty(db, { q: "Computer Science" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(names(searchFaculty(db, { q: "Information Technology" }, MONDAY_2PM))).toEqual([
      "Melchora Aquino",
      "Trinidad Tecson",
    ]);
  });

  it("treats a short query as a code, not as a substring", () => {
    // "Algorithms" and "Writing" both contain the letters "it"; a student
    // typing the department code means the department.
    expect(names(searchFaculty(db, { q: "IT" }, MONDAY_2PM))).toEqual([
      "Melchora Aquino",
      "Trinidad Tecson",
    ]);
    expect(names(searchFaculty(db, { q: "cs" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(names(searchFaculty(db, { q: "CCIS" }, MONDAY_2PM))).toHaveLength(3);
  });

  it("matches a room number exactly on a short query, not by substring", () => {
    expect(names(searchFaculty(db, { q: "1" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(names(searchFaculty(db, { q: "3" }, MONDAY_2PM))).toEqual(["Melchora Aquino"]);
  });

  it("still matches a name by its opening letters when the query is short", () => {
    expect(names(searchFaculty(db, { q: "Jua" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
  });

  it("finds by room number and by room name", () => {
    expect(names(searchFaculty(db, { q: "12" }, MONDAY_2PM))).toEqual(["Trinidad Tecson"]);
    expect(names(searchFaculty(db, { q: "Faculty Office" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(names(searchFaculty(db, { q: "Laboratory" }, MONDAY_2PM))).toEqual(["Trinidad Tecson"]);
  });

  it("finds by subject on a longer query", () => {
    expect(names(searchFaculty(db, { q: "Algorithms" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
  });

  it("finds by building name", () => {
    expect(searchFaculty(db, { q: "CCIS Building" }, MONDAY_2PM)).toHaveLength(3);
  });

  it("finds by academic title", () => {
    expect(names(searchFaculty(db, { q: "Instructor" }, MONDAY_2PM))).toEqual(["Trinidad Tecson"]);
  });

  it("returns an empty list rather than throwing on no match", () => {
    expect(searchFaculty(db, { q: "Professor Nonexistent" }, MONDAY_2PM)).toEqual([]);
  });

  it("sorts results by name so the list is stable between loads", () => {
    // Matches all three by three different columns: department, subject, room.
    expect(names(searchFaculty(db, { q: "Computer" }, MONDAY_2PM))).toEqual([
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
    expect(names(searchFaculty(db, { department: "CS" }, MONDAY_2PM))).toEqual(["Juan Santos"]);
  });

  it("filters by the floor the student is standing on", () => {
    expect(names(searchFaculty(db, { floor: 1 }, MONDAY_2PM))).toEqual([
      "Juan Santos",
      "Melchora Aquino",
    ]);
    expect(names(searchFaculty(db, { floor: 2 }, MONDAY_2PM))).toEqual(["Trinidad Tecson"]);
    expect(searchFaculty(db, { floor: 9 }, MONDAY_2PM)).toEqual([]);
  });

  it("excludes faculty with no room from a floor filter", () => {
    db.prepare("UPDATE faculty SET room_id = NULL WHERE id = 1").run();
    expect(names(searchFaculty(db, { floor: 1 }, MONDAY_2PM))).toEqual(["Melchora Aquino"]);
    expect(searchFaculty(db, {}, MONDAY_2PM)).toHaveLength(3);
  });

  it("filters by the weekday a student is free", () => {
    expect(names(searchFaculty(db, { weekday: 3 }, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(searchFaculty(db, { weekday: 6 }, MONDAY_2PM)).toEqual([]);
  });

  it("combines a query with a filter", () => {
    expect(searchFaculty(db, { q: "Professor", department: "IT" }, MONDAY_2PM)).toHaveLength(1);
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
  it("hydrates office, room, hours, subjects and availability in one read", () => {
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.full_name).toBe("Juan Santos");
    expect(santos.building_name).toBe("CCIS Building");
    expect(santos.department_name).toBe("Computer Science");
    expect(santos.college_code).toBe("CCIS");
    expect(santos.room_number).toBe("1");
    expect(santos.room_name).toBe("CCIS Faculty Office");
    expect(santos.room_floor).toBe(1);
    expect(santos.floorLabel).toBe("1st floor");
    expect(santos.officeLabel).toBe("CCIS Building — Room 1");
    expect(santos.subjectList).toEqual(["Data Structures", "Algorithms"]);
    expect(santos.officeHours).toHaveLength(2);
    expect(santos.availability.state).toBe("office_hours");
    expect(santos.building_entrance).toContain("Main entrance");
  });

  it("starts with no photo, so the placeholder is what students see", () => {
    expect(getFaculty(db, 1, MONDAY_2PM)!.photo_url).toBe("");
  });

  it("says so plainly when no office has been assigned", () => {
    db.prepare("UPDATE faculty SET room_id = NULL WHERE id = 1").run();
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.officeLabel).toBe("Office not yet assigned");
    expect(santos.room_number).toBeNull();
    expect(santos.building_name).toBeNull();
    expect(santos.floorLabel).toBe("");
  });

  it("carries a per-block location note through to the profile", () => {
    const aquino = getFaculty(db, 2, MONDAY_2PM)!;
    expect(aquino.officeHours[0].location_note).toBe("Networking Laboratory");
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

describe("rooms and floors", () => {
  it("lists the rooms on a floor in door order, with occupant counts", () => {
    const floor1 = listRooms(db, 1);
    expect(floor1.map((r) => r.number)).toEqual(["1", "3"]);
    expect(floor1[0].name).toBe("CCIS Faculty Office");
    expect(floor1[0].occupants).toBe(1);
    expect(floor1[0].map_w).toBe(26);
  });

  it("lists every room when no floor is given", () => {
    expect(listRooms(db)).toHaveLength(3);
  });

  it("does not count archived faculty as occupying a room", () => {
    db.prepare("UPDATE faculty SET is_active = 0 WHERE id = 1").run();
    expect(listRooms(db, 1)[0].occupants).toBe(0);
  });

  it("lists the floors that actually have rooms mapped", () => {
    expect(listFloors(db)).toEqual([1, 2]);
  });

  it("finds everyone whose office is a given room", () => {
    expect(names(facultyInRoom(db, 1, MONDAY_2PM))).toEqual(["Juan Santos"]);
    expect(facultyInRoom(db, 9999, MONDAY_2PM)).toEqual([]);
  });

  it("names floors the way a sign in a stairwell does", () => {
    expect(floorLabel(1)).toBe("1st floor");
    expect(floorLabel(2)).toBe("2nd floor");
    expect(floorLabel(3)).toBe("3rd floor");
    expect(floorLabel(4)).toBe("4th floor");
    expect(floorLabel(11)).toBe("11th floor");
    expect(floorLabel(null)).toBe("");
  });
});

describe("reference data", () => {
  it("lists the one building FIND covers", () => {
    expect(listBuildings(db).map((b) => b.code)).toEqual(["CCIS"]);
    expect(primaryBuilding(db)?.name).toBe("CCIS Building");
    expect(primaryBuilding(db)?.floors).toBe(2);
  });

  it("lists departments with their college", () => {
    const depts = listDepartments(db);
    expect(depts.map((d) => d.code)).toEqual(["CS", "IT"]);
    expect(depts.every((d) => d.college_code === "CCIS")).toBe(true);
    expect(depts[0].building_name).toBe("CCIS Building");
  });
});

describe("row shape", () => {
  // node:sqlite hands back null-prototype objects, which React refuses to send
  // from a Server Component to a Client Component. Every query must normalise.
  it("returns plain objects React can serialise to client components", () => {
    const record = getFaculty(db, 1, MONDAY_2PM)!;
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(record.officeHours[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(listRooms(db)[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(listDepartments(db)[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(searchFaculty(db, {}, MONDAY_2PM)[0])).toBe(Object.prototype);
    expect(() => JSON.parse(JSON.stringify(record))).not.toThrow();
  });
});
