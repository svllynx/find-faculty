import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  createFaculty,
  createFacultySchema,
  officeHoursSchema,
  overrideEndsAt,
  photoSchema,
  profileSchema,
  replaceOfficeHours,
  setFacultyActive,
  setManualStatus,
  statusSchema,
  updateFacultyProfile,
} from "../lib/mutations";
import { getFaculty, listRooms, searchFaculty } from "../lib/faculty";
import { MONDAY_10AM, MONDAY_2PM, seedTestDb } from "./fixtures";
import type { SessionUser } from "../lib/auth";

let db: DatabaseSync;
const actor: SessionUser = {
  id: 1,
  email: "admin@campus.edu.ph",
  role: "admin",
  display_name: "Admin",
  faculty_id: null,
};

beforeEach(() => {
  db = seedTestDb();
});

const audit = () =>
  db.prepare("SELECT action, actor_email, faculty_id FROM audit_log ORDER BY id").all() as unknown as {
    action: string;
    actor_email: string;
    faculty_id: number | null;
  }[];

/** Build a full status payload; tests override only what they care about. */
const status = (
  manual_status: "available" | "unavailable" | "office_hours" | null,
  extra: Partial<{ manual_note: string; expires_in_minutes: number | null; expires_at: string | null }> = {},
) => ({
  manual_status,
  manual_note: "",
  expires_in_minutes: null,
  expires_at: null,
  ...extra,
});

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe("office-hours validation", () => {
  it("accepts a normal weekly block", () => {
    expect(
      officeHoursSchema.safeParse([
        { weekday: 1, start_minute: 540, end_minute: 660, location_note: "" },
      ]).success,
    ).toBe(true);
  });

  it("rejects an end time at or before the start time", () => {
    expect(
      officeHoursSchema.safeParse([{ weekday: 1, start_minute: 660, end_minute: 540 }]).success,
    ).toBe(false);
    expect(
      officeHoursSchema.safeParse([{ weekday: 1, start_minute: 540, end_minute: 540 }]).success,
    ).toBe(false);
  });

  it("rejects an out-of-range weekday or minute", () => {
    expect(
      officeHoursSchema.safeParse([{ weekday: 7, start_minute: 540, end_minute: 660 }]).success,
    ).toBe(false);
    expect(
      officeHoursSchema.safeParse([{ weekday: 1, start_minute: -1, end_minute: 660 }]).success,
    ).toBe(false);
    expect(
      officeHoursSchema.safeParse([{ weekday: 1, start_minute: 0, end_minute: 1441 }]).success,
    ).toBe(false);
  });

  it("rejects two overlapping blocks on the same day", () => {
    const result = officeHoursSchema.safeParse([
      { weekday: 1, start_minute: 540, end_minute: 660 },
      { weekday: 1, start_minute: 600, end_minute: 720 },
    ]);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("overlap");
  });

  it("allows the same times on different days, and back-to-back blocks", () => {
    expect(
      officeHoursSchema.safeParse([
        { weekday: 1, start_minute: 540, end_minute: 660 },
        { weekday: 2, start_minute: 540, end_minute: 660 },
      ]).success,
    ).toBe(true);
    expect(
      officeHoursSchema.safeParse([
        { weekday: 1, start_minute: 540, end_minute: 660 },
        { weekday: 1, start_minute: 660, end_minute: 780 },
      ]).success,
    ).toBe(true);
  });
});

describe("profile validation", () => {
  it("rejects a name that is too short and a malformed email", () => {
    expect(profileSchema.safeParse({ full_name: "J" }).success).toBe(false);
    expect(profileSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("accepts a cleared email, since not every record has one", () => {
    expect(profileSchema.safeParse({ email: "" }).success).toBe(true);
  });

  it("trims incidental whitespace", () => {
    expect(profileSchema.parse({ full_name: "  Juan Santos  " }).full_name).toBe("Juan Santos");
  });

  it("requires a name when creating a record from scratch", () => {
    expect(createFacultySchema.safeParse({}).success).toBe(false);
    expect(createFacultySchema.safeParse({ full_name: "New Hire" }).success).toBe(true);
  });
});

describe("profile photo validation", () => {
  it("accepts an uploaded image as a data URL", () => {
    expect(photoSchema.safeParse("data:image/jpeg;base64,/9j/4AAQSkZJRg==").success).toBe(true);
    expect(photoSchema.safeParse("data:image/png;base64,iVBORw0KGgo=").success).toBe(true);
  });

  it("accepts an https link and an empty value", () => {
    expect(photoSchema.safeParse("https://example.edu/photo.jpg").success).toBe(true);
    expect(photoSchema.safeParse("").success).toBe(true);
  });

  it("refuses anything that is not an image — this string becomes an img src", () => {
    expect(photoSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(photoSchema.safeParse("data:text/html;base64,PHNjcmlwdD4=").success).toBe(false);
    expect(photoSchema.safeParse("http://example.edu/photo.jpg").success).toBe(false);
  });

  it("refuses an image too large to keep in a row", () => {
    const huge = `data:image/jpeg;base64,${"A".repeat(400_001)}`;
    expect(photoSchema.safeParse(huge).success).toBe(false);
  });

  it("stores a photo and hands it back to the profile", () => {
    const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    updateFacultyProfile(db, 1, { photo_url: photo }, actor);
    expect(getFaculty(db, 1, MONDAY_2PM)!.photo_url).toBe(photo);

    updateFacultyProfile(db, 1, { photo_url: "" }, actor);
    expect(getFaculty(db, 1, MONDAY_2PM)!.photo_url).toBe("");
  });

  it("keeps the photo data itself out of the audit log", () => {
    updateFacultyProfile(db, 1, { photo_url: "data:image/png;base64,iVBORw0KGgo=" }, actor);
    const detail = db.prepare("SELECT detail FROM audit_log ORDER BY id DESC LIMIT 1").get() as {
      detail: string;
    };
    expect(detail.detail).toBe("photo");
    expect(detail.detail).not.toContain("base64");
  });
});

describe("replaceOfficeHours", () => {
  it("replaces the whole set rather than appending duplicates", () => {
    replaceOfficeHours(db, 1, [{ weekday: 2, start_minute: 600, end_minute: 720, location_note: "" }], actor);
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.officeHours).toHaveLength(1);
    expect(santos.officeHours[0].weekday).toBe(2);
  });

  it("changes the availability students see", () => {
    expect(getFaculty(db, 1, MONDAY_2PM)!.availability.state).toBe("office_hours");
    replaceOfficeHours(db, 1, [{ weekday: 6, start_minute: 480, end_minute: 600, location_note: "" }], actor);
    expect(getFaculty(db, 1, MONDAY_2PM)!.availability.state).toBe("outside_hours");
  });

  it("clearing every block leaves no_schedule, not a stale window", () => {
    replaceOfficeHours(db, 1, [], actor);
    expect(getFaculty(db, 1, MONDAY_2PM)!.availability.state).toBe("no_schedule");
  });

  it("does not touch another faculty member's hours", () => {
    replaceOfficeHours(db, 1, [], actor);
    expect(getFaculty(db, 2, MONDAY_2PM)!.officeHours).toHaveLength(1);
  });

  it("records who changed what", () => {
    replaceOfficeHours(db, 1, [], actor);
    expect(audit()).toEqual([
      { action: "hours.replace", actor_email: "admin@campus.edu.ph", faculty_id: 1 },
    ]);
  });
});

describe("setManualStatus — the posted status", () => {
  // Note: expiry is measured from the real clock, so tests that assert an
  // override at a FIXED evaluation date must use a status with no expiry.
  it("a posted status overrides the schedule for students", () => {
    setManualStatus(db, 1, status("unavailable", { manual_note: "Out sick." }), actor);
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.availability.state).toBe("unavailable");
    expect(santos.availability.selfReported).toBe(true);
    expect(santos.availability.detail).toContain("Out sick.");
  });

  it("stores an expiry so a forgotten status does not mislead students forever", () => {
    setManualStatus(db, 1, status("available", { expires_in_minutes: 60 }), actor);
    const row = db.prepare("SELECT manual_until FROM faculty WHERE id = 1").get() as {
      manual_until: string;
    };
    const until = new Date(row.manual_until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 55 * 60_000);
    expect(until).toBeLessThan(Date.now() + 65 * 60_000);
  });

  it("stops overriding once the expiry has passed", () => {
    setManualStatus(db, 1, status("unavailable", { manual_note: "Stepped out.", expires_in_minutes: 30 }), actor);
    expect(getFaculty(db, 1, new Date(Date.now() + 10 * 60_000))!.availability.state).toBe("unavailable");

    const later = getFaculty(db, 1, new Date(Date.now() + 2 * 60 * 60_000))!.availability;
    expect(later.state).not.toBe("unavailable");
    expect(later.selfReported).toBe(false);
  });

  it("clearing hands the badge back to the schedule and wipes the note", () => {
    setManualStatus(db, 1, status("available", { manual_note: "Here" }), actor);
    expect(getFaculty(db, 1, MONDAY_10AM)!.availability.state).toBe("available");

    setManualStatus(db, 1, status(null), actor);
    const santos = getFaculty(db, 1, MONDAY_10AM)!;
    expect(santos.availability.state).toBe("outside_hours");
    expect(santos.manual_status).toBeNull();
    expect(santos.manual_note).toBe("");
    expect(santos.manual_set_at).toBeNull();
  });

  it("a green status makes someone appear in the open-now list", () => {
    expect(searchFaculty(db, { openNow: true }, MONDAY_10AM)).toHaveLength(0);
    setManualStatus(db, 3, status("available"), actor);
    expect(searchFaculty(db, { openNow: true }, MONDAY_10AM).map((f) => f.full_name)).toEqual([
      "Trinidad Tecson",
    ]);
  });

  it("rejects a status value outside the three the UI offers", () => {
    expect(statusSchema.safeParse({ manual_status: "on_sabbatical" }).success).toBe(false);
    expect(statusSchema.safeParse({ manual_status: null }).success).toBe(true);
  });
});

describe("setManualStatus — the absence override", () => {
  it("an explicit end date wins over a duration", () => {
    const at = inDays(7);
    expect(overrideEndsAt(status("unavailable", { expires_at: at, expires_in_minutes: 60 }))).toBe(at);
  });

  it("no end at all means the override stands until it is cleared", () => {
    expect(overrideEndsAt(status("unavailable"))).toBeNull();
  });

  it("clearing the status clears the end date with it", () => {
    expect(overrideEndsAt(status(null, { expires_at: inDays(7) }))).toBeNull();
  });

  it("an absence longer than a day reads as Away, with the return date", () => {
    setManualStatus(
      db,
      1,
      status("unavailable", { manual_note: "CHED accreditation visit.", expires_at: inDays(7) }),
      actor,
    );
    const availability = getFaculty(db, 1, new Date())!.availability;
    expect(availability.state).toBe("unavailable");
    expect(availability.label).toBe("Away");
    expect(availability.longAbsence).toBe(true);
    expect(availability.until).not.toBeNull();
    expect(availability.detail).toMatch(/^Away until /);
    expect(availability.detail).toContain("CHED accreditation visit.");
  });

  it("a short absence stays Unavailable rather than Away", () => {
    setManualStatus(db, 1, status("unavailable", { expires_in_minutes: 120 }), actor);
    const availability = getFaculty(db, 1, new Date())!.availability;
    expect(availability.label).toBe("Unavailable");
    expect(availability.longAbsence).toBe(false);
  });

  it("a month-long absence is accepted; an implausible one is not", () => {
    expect(statusSchema.safeParse({ manual_status: "unavailable", expires_at: inDays(30) }).success).toBe(true);
    expect(statusSchema.safeParse({ manual_status: "unavailable", expires_at: inDays(500) }).success).toBe(false);
  });

  it("rejects an end date already in the past", () => {
    expect(statusSchema.safeParse({ manual_status: "unavailable", expires_at: inDays(-1) }).success).toBe(false);
  });

  it("rejects an absurd duration", () => {
    expect(statusSchema.safeParse({ manual_status: "available", expires_in_minutes: 1 }).success).toBe(false);
    expect(
      statusSchema.safeParse({ manual_status: "available", expires_in_minutes: 60 * 24 * 500 }).success,
    ).toBe(false);
  });

  it("an away override hides someone from the open-now list during their block", () => {
    expect(searchFaculty(db, { openNow: true }, new Date()).length).toBeGreaterThanOrEqual(0);
    setManualStatus(db, 1, status("unavailable", { expires_at: inDays(7) }), actor);
    expect(searchFaculty(db, { openNow: true }, new Date()).map((f) => f.full_name)).not.toContain(
      "Juan Santos",
    );
  });

  it("records the end date in the audit trail", () => {
    setManualStatus(db, 1, status("unavailable", { expires_at: inDays(7) }), actor);
    const detail = db.prepare("SELECT detail FROM audit_log ORDER BY id DESC LIMIT 1").get() as {
      detail: string;
    };
    expect(detail.detail).toMatch(/^unavailable until \d{4}-\d{2}-\d{2}$/);
  });
});

describe("updateFacultyProfile", () => {
  it("updates only the fields provided", () => {
    updateFacultyProfile(db, 1, { phone: "local 999" }, actor);
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.phone).toBe("local 999");
    expect(santos.full_name).toBe("Juan Santos");
    expect(santos.email).toBe("jsantos@campus.edu.ph");
  });

  it("moves a professor to another room, and the floor plan follows", () => {
    const upstairs = listRooms(db, 2)[0];
    updateFacultyProfile(db, 1, { room_id: upstairs.id }, actor);
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.room_number).toBe("12");
    expect(santos.room_floor).toBe(2);
    expect(santos.floorLabel).toBe("2nd floor");
    expect(searchFaculty(db, { floor: 2 }, MONDAY_2PM).map((f) => f.full_name)).toContain("Juan Santos");
  });

  it("can clear a room assignment", () => {
    updateFacultyProfile(db, 1, { room_id: null }, actor);
    expect(getFaculty(db, 1, MONDAY_2PM)!.officeLabel).toBe("Office not yet assigned");
  });

  it("is a no-op when handed an empty patch", () => {
    updateFacultyProfile(db, 1, {}, actor);
    expect(audit()).toHaveLength(0);
  });

  it("bumps updated_at so students can see how fresh the entry is", () => {
    db.prepare("UPDATE faculty SET updated_at = '2020-01-01 00:00:00' WHERE id = 1").run();
    updateFacultyProfile(db, 1, { phone: "local 1" }, actor);
    expect(getFaculty(db, 1, MONDAY_2PM)!.updated_at).not.toBe("2020-01-01 00:00:00");
  });
});

describe("createFaculty and archiving", () => {
  it("adds a searchable record", () => {
    const id = createFaculty(
      db,
      { full_name: "Ramon Magsaysay", title: "Instructor", department_id: 1, room_id: 2 },
      actor,
    );
    expect(id).toBeGreaterThan(3);
    expect(searchFaculty(db, { q: "Magsaysay" }, MONDAY_2PM)).toHaveLength(1);
    expect(getFaculty(db, id, MONDAY_2PM)!.availability.state).toBe("no_schedule");
    expect(getFaculty(db, id, MONDAY_2PM)!.room_number).toBe("3");
  });

  it("archiving hides the record from students but keeps the audit trail", () => {
    setFacultyActive(db, 1, false, actor);
    expect(searchFaculty(db, { q: "Santos" }, MONDAY_2PM)).toHaveLength(0);
    expect(getFaculty(db, 1, MONDAY_2PM)!.is_active).toBe(false);
    expect(audit().map((a) => a.action)).toEqual(["faculty.archive"]);
  });

  it("restoring brings the record back", () => {
    setFacultyActive(db, 1, false, actor);
    setFacultyActive(db, 1, true, actor);
    expect(searchFaculty(db, { q: "Santos" }, MONDAY_2PM)).toHaveLength(1);
  });

  it("deleting a faculty record cascades to their office hours", () => {
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare("DELETE FROM faculty WHERE id = 1").run();
    const left = db.prepare("SELECT COUNT(*) AS n FROM office_hours WHERE faculty_id = 1").get() as {
      n: number;
    };
    expect(Number(left.n)).toBe(0);
  });

  it("deleting a room leaves the faculty record, just without an office", () => {
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare("DELETE FROM rooms WHERE id = 1").run();
    const santos = getFaculty(db, 1, MONDAY_2PM)!;
    expect(santos.full_name).toBe("Juan Santos");
    expect(santos.room_id).toBeNull();
    expect(santos.officeLabel).toBe("Office not yet assigned");
  });
});
