import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { transaction } from "./db";
import { auditLog, type SessionUser } from "./auth";

/** Validation lives next to the writes so every entry point shares one contract. */

export const officeHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_minute: z.number().int().min(0).max(1439),
    end_minute: z.number().int().min(1).max(1440),
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

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  title: z.string().trim().max(80).optional(),
  department_id: z.number().int().positive().nullable().optional(),
  building_id: z.number().int().positive().nullable().optional(),
  room: z.string().trim().max(20).optional(),
  floor: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  subjects: z.string().trim().max(400).optional(),
  consultation_note: z.string().trim().max(400).optional(),
});

export const statusSchema = z.object({
  /** null clears the manual status and hands the badge back to the schedule. */
  manual_status: z.enum(["available", "unavailable", "office_hours"]).nullable(),
  manual_note: z.string().trim().max(200).default(""),
  /** Minutes from now until the status expires. Omit for "until I clear it". */
  expires_in_minutes: z.number().int().min(5).max(60 * 24 * 14).nullable().default(null),
});

export const createFacultySchema = profileSchema.extend({
  full_name: z.string().trim().min(2).max(120),
});

const PROFILE_COLUMNS = [
  "full_name",
  "title",
  "department_id",
  "building_id",
  "room",
  "floor",
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
    auditLog(db, actor, "faculty.update", facultyId, Object.keys(input).join(", "));
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
      `INSERT INTO office_hours (faculty_id, weekday, start_minute, end_minute, location_note)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const h of hours) {
      insert.run(facultyId, h.weekday, h.start_minute, h.end_minute, h.location_note ?? "");
    }
    db.prepare("UPDATE faculty SET updated_at = datetime('now') WHERE id = ?").run(facultyId);
    auditLog(db, actor, "hours.replace", facultyId, `${hours.length} block(s)`);
  });
}

export function setManualStatus(
  db: DatabaseSync,
  facultyId: number,
  input: z.infer<typeof statusSchema>,
  actor: SessionUser | null,
): void {
  const until =
    input.manual_status && input.expires_in_minutes
      ? new Date(Date.now() + input.expires_in_minutes * 60_000).toISOString()
      : null;

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
    auditLog(db, actor, "status.set", facultyId, input.manual_status ?? "cleared");
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
        `INSERT INTO faculty (full_name, title, department_id, building_id, room, floor,
                              email, phone, subjects, consultation_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.full_name,
        input.title ?? "",
        input.department_id ?? null,
        input.building_id ?? null,
        input.room ?? "",
        input.floor ?? "",
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
