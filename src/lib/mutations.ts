import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { transaction } from "./db";
import { auditLog, type SessionUser } from "./auth";

/** Validation lives next to the writes so every entry point shares one contract. */

export const scheduleTypeSchema = z.enum(["office", "consultation", "class"]);

export const officeHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_minute: z.number().int().min(0).max(1439),
    end_minute: z.number().int().min(1).max(1440),
    type: scheduleTypeSchema.default("office"),
    location_note: z.string().max(120).default(""),
  })
  .refine((h) => h.end_minute > h.start_minute, {
    message: "End time must be after start time",
  });

export const officeHoursSchema = z
  .array(officeHourSchema)
  .max(30)
  .superRefine((hours, ctx) => {
    // Overlapping windows on the same day would make "open now" ambiguous.
    const byDay = new Map<number, typeof hours>();
    for (const h of hours) {
      const list = byDay.get(h.weekday) ?? [];
      list.push(h);
      byDay.set(h.weekday, list);
    }
    for (const [, list] of byDay) {
      const sorted = [...list].sort((a, b) => a.start_minute - b.start_minute);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].start_minute < sorted[i - 1].end_minute) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Two office-hour blocks on the same day overlap",
          });
          return;
        }
      }
    }
  });

/**
 * A profile photo is either an image the faculty member uploaded (stored inline
 * as a data URL, so FIND needs no file storage and works on a read-only host)
 * or an https link. Anything else — javascript:, http:, a non-image data URL —
 * is refused, because this string is rendered as an image src.
 */
const PHOTO_MAX = 400_000; // ~300 KB of image once base64-decoded
export const photoSchema = z
  .string()
  .trim()
  .max(PHOTO_MAX, { message: "That image is too large. Please use one under 300 KB." })
  .refine(
    (v) =>
      v === "" ||
      /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ||
      /^https:\/\/[^\s]+$/.test(v),
    { message: "Use an uploaded image or an https link" },
  );

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  title: z.string().trim().max(80).optional(),
  department_id: z.number().int().positive().nullable().optional(),
  /** The room this faculty member sits in; null means not assigned yet. */
  room_id: z.number().int().positive().nullable().optional(),
  photo_url: photoSchema.optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  subjects: z.string().trim().max(400).optional(),
  consultation_note: z.string().trim().max(400).optional(),
});

/** A year out is past any plausible sabbatical, and keeps a typo from sticking. */
const MAX_OVERRIDE_DAYS = 400;

export const statusSchema = z
  .object({
    /** null clears the override and hands the badge back to the schedule. */
    manual_status: z.enum(["available", "unavailable", "office_hours"]).nullable(),
    manual_note: z.string().trim().max(200).default(""),
    /** Short overrides: minutes from now. */
    expires_in_minutes: z
      .number()
      .int()
      .min(5)
      .max(60 * 24 * MAX_OVERRIDE_DAYS)
      .nullable()
      .default(null),
    /** Long overrides ("away until the 3rd"): an explicit end, as an ISO datetime. */
    expires_at: z.string().datetime().nullable().default(null),
  })
  .superRefine((input, ctx) => {
    if (!input.expires_at) return;
    const until = new Date(input.expires_at);
    if (until.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at"],
        message: "Choose an end date in the future",
      });
    }
    if (until.getTime() > Date.now() + MAX_OVERRIDE_DAYS * 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at"],
        message: `An override cannot run more than ${MAX_OVERRIDE_DAYS} days`,
      });
    }
  });

export const createFacultySchema = profileSchema.extend({
  full_name: z.string().trim().min(2).max(120),
});

const PROFILE_COLUMNS = [
  "full_name",
  "title",
  "department_id",
  "room_id",
  "photo_url",
  "email",
  "phone",
  "subjects",
  "consultation_note",
] as const;

export function updateFacultyProfile(
  db: DatabaseSync,
  facultyId: number,
  input: z.infer<typeof profileSchema>,
  actor: SessionUser | null,
): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  for (const column of PROFILE_COLUMNS) {
    const value = input[column];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(value as string | number | null);
  }
  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(facultyId);

  transaction(db, () => {
    db.prepare(`UPDATE faculty SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    // A photo is a long data URL; log that it changed, never the value itself.
    const changed = Object.keys(input).map((k) => (k === "photo_url" ? "photo" : k));
    auditLog(db, actor, "faculty.update", facultyId, changed.join(", "));
  });
}

export function replaceOfficeHours(
  db: DatabaseSync,
  facultyId: number,
  hours: z.infer<typeof officeHoursSchema>,
  actor: SessionUser | null,
): void {
  transaction(db, () => {
    db.prepare("DELETE FROM office_hours WHERE faculty_id = ?").run(facultyId);
    const insert = db.prepare(
      `INSERT INTO office_hours (faculty_id, weekday, start_minute, end_minute, type, location_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const h of hours) {
      insert.run(
        facultyId,
        h.weekday,
        h.start_minute,
        h.end_minute,
        h.type ?? "office",
        h.location_note ?? "",
      );
    }
    db.prepare("UPDATE faculty SET updated_at = datetime('now') WHERE id = ?").run(facultyId);
    auditLog(db, actor, "hours.replace", facultyId, `${hours.length} block(s)`);
  });
}

/** Work out when an override should lapse. An explicit date wins over a duration. */
export function overrideEndsAt(input: z.infer<typeof statusSchema>, now = Date.now()): string | null {
  if (!input.manual_status) return null;
  if (input.expires_at) return new Date(input.expires_at).toISOString();
  if (input.expires_in_minutes) return new Date(now + input.expires_in_minutes * 60_000).toISOString();
  return null; // stands until cleared
}

export function setManualStatus(
  db: DatabaseSync,
  facultyId: number,
  input: z.infer<typeof statusSchema>,
  actor: SessionUser | null,
): void {
  const until = overrideEndsAt(input);

  transaction(db, () => {
    db.prepare(
      `UPDATE faculty
          SET manual_status = ?, manual_note = ?, manual_until = ?,
              manual_set_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END,
              updated_at = datetime('now')
        WHERE id = ?`,
    ).run(
      input.manual_status,
      input.manual_status ? input.manual_note : "",
      until,
      input.manual_status,
      facultyId,
    );
    auditLog(
      db,
      actor,
      "status.set",
      facultyId,
      input.manual_status ? `${input.manual_status}${until ? ` until ${until.slice(0, 10)}` : ""}` : "cleared",
    );
  });
}

export function createFaculty(
  db: DatabaseSync,
  input: z.infer<typeof createFacultySchema>,
  actor: SessionUser | null,
): number {
  return transaction(db, () => {
    const result = db
      .prepare(
        `INSERT INTO faculty (full_name, title, department_id, room_id, photo_url,
                              email, phone, subjects, consultation_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.full_name,
        input.title ?? "",
        input.department_id ?? null,
        input.room_id ?? null,
        input.photo_url ?? "",
        input.email ?? "",
        input.phone ?? "",
        input.subjects ?? "",
        input.consultation_note ?? "",
      );
    const id = Number(result.lastInsertRowid);
    auditLog(db, actor, "faculty.create", id, input.full_name);
    return id;
  });
}

/**
 * A student's appointment request against one published block. Anonymous by
 * design — students never sign in — so the request carries a name and email
 * rather than a user id. The requested slot is copied in whole (date, weekday,
 * times, type) rather than just referencing the office_hours row, so the
 * request still reads correctly even if that block is later edited or removed.
 */
export const createAppointmentSchema = z.object({
  office_hour_id: z.number().int().positive().nullable().default(null),
  student_name: z.string().trim().min(2).max(120),
  student_email: z.string().trim().email(),
  reason: z.string().trim().max(400).default(""),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  weekday: z.number().int().min(0).max(6),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  type: scheduleTypeSchema.default("office"),
});

export function createAppointment(
  db: DatabaseSync,
  facultyId: number,
  input: z.infer<typeof createAppointmentSchema>,
): number {
  return transaction(db, () => {
    const result = db
      .prepare(
        `INSERT INTO appointments
           (faculty_id, office_hour_id, student_name, student_email, reason,
            requested_date, weekday, start_minute, end_minute, schedule_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        facultyId,
        input.office_hour_id,
        input.student_name,
        input.student_email,
        input.reason,
        input.requested_date,
        input.weekday,
        input.start_minute,
        input.end_minute,
        input.type,
      );
    const id = Number(result.lastInsertRowid);
    auditLog(
      db,
      null,
      "appointment.request",
      facultyId,
      `${input.student_name} requested ${input.requested_date}`,
    );
    return id;
  });
}

export const appointmentResponseSchema = z.object({
  status: z.enum(["approved", "declined", "cancelled"]),
  faculty_note: z.string().trim().max(300).default(""),
});

export function respondToAppointment(
  db: DatabaseSync,
  appointmentId: number,
  facultyId: number,
  input: z.infer<typeof appointmentResponseSchema>,
  actor: SessionUser | null,
): void {
  transaction(db, () => {
    db.prepare(
      `UPDATE appointments
          SET status = ?, faculty_note = ?, updated_at = datetime('now')
        WHERE id = ? AND faculty_id = ?`,
    ).run(input.status, input.faculty_note, appointmentId, facultyId);
    auditLog(db, actor, `appointment.${input.status}`, facultyId, `#${appointmentId}`);
  });
}

/** Soft delete — the record stays for audit history and can be restored. */
export function setFacultyActive(
  db: DatabaseSync,
  facultyId: number,
  active: boolean,
  actor: SessionUser | null,
): void {
  transaction(db, () => {
    db.prepare("UPDATE faculty SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
      active ? 1 : 0,
      facultyId,
    );
    auditLog(db, actor, active ? "faculty.restore" : "faculty.archive", facultyId, "");
  });
}
