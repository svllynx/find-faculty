import type { DatabaseSync } from "node:sqlite";
import { rows } from "./db";
import type { ScheduleType } from "./availability";
import { CAMPUS_TZ } from "./time";

/**
 * Appointment reads. Writes live in mutations.ts, next to the rest of the
 * write-side contract — this file is the read half, matching the split
 * faculty.ts/mutations.ts already uses.
 */

export type AppointmentStatus = "pending" | "approved" | "declined" | "cancelled";

export type AppointmentRecord = {
  id: number;
  faculty_id: number;
  office_hour_id: number | null;
  student_name: string;
  student_email: string;
  reason: string;
  requested_date: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  schedule_type: ScheduleType;
  status: AppointmentStatus;
  faculty_note: string;
  created_at: string;
  updated_at: string;
};

export function listAppointmentsForFaculty(
  db: DatabaseSync,
  facultyId: number,
  opts: { status?: AppointmentStatus } = {},
): AppointmentRecord[] {
  const where = opts.status
    ? "WHERE faculty_id = ? AND status = ?"
    : "WHERE faculty_id = ?";
  const params = opts.status ? [facultyId, opts.status] : [facultyId];
  return rows<AppointmentRecord>(
    db
      .prepare(
        `SELECT * FROM appointments ${where}
          ORDER BY (status = 'pending') DESC, requested_date, start_minute`,
      )
      .all(...params),
  );
}

/** All pending requests across every faculty member — the admin inbox. */
export function listPendingAppointments(db: DatabaseSync): (AppointmentRecord & {
  faculty_name: string;
})[] {
  return rows(
    db
      .prepare(
        `SELECT a.*, f.full_name AS faculty_name
           FROM appointments a JOIN faculty f ON f.id = a.faculty_id
          WHERE a.status = 'pending'
          ORDER BY a.requested_date, a.start_minute`,
      )
      .all(),
  );
}

/**
 * The next `count` calendar dates (campus time, soonest first) that fall on
 * `weekday`, as 'YYYY-MM-DD' — so a student requesting a weekly recurring
 * block picks an actual day rather than just "Mondays".
 */
export function upcomingDatesFor(weekday: number, count = 4, from: Date = new Date()): string[] {
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(from);
  const get = (type: string) => todayParts.find((p) => p.type === type)?.value ?? "";
  const todayIso = `${get("year")}-${get("month")}-${get("day")}`;
  const todayDate = new Date(`${todayIso}T12:00:00Z`); // noon UTC avoids DST/offset edge cases
  const todayWeekday = todayDate.getUTCDay();

  const firstOffset = (weekday - todayWeekday + 7) % 7;
  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() + firstOffset + i * 7);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
