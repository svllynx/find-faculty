/**
 * Campus-clock helpers. Office hours are minutes-from-midnight integers;
 * everything user-facing is formatted through here so the whole app agrees
 * on one timezone and one 12-hour format.
 */

export const CAMPUS_TZ = process.env.FIND_TZ ?? "Asia/Manila";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** A moment on the campus clock, reduced to what availability logic needs. */
export type CampusNow = {
  /** 0 = Sunday */
  weekday: number;
  /** minutes since midnight, campus time */
  minute: number;
  /** the underlying instant, for comparing against manual_until */
  instant: Date;
};

export function campusNow(at: Date = new Date(), timeZone: string = CAMPUS_TZ): CampusNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = SHORT_WEEKDAYS.indexOf(get("weekday") as (typeof SHORT_WEEKDAYS)[number]);
  // Intl can emit "24" for midnight in hour12:false mode.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  return {
    weekday: weekday === -1 ? at.getDay() : weekday,
    minute: hour * 60 + minute,
    instant: at,
  };
}

/** 545 -> "9:05 AM" */
export function formatMinute(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${suffix}`;
}

/** 540, 660 -> "9:00 AM – 11:00 AM" */
export function formatRange(startMinute: number, endMinute: number): string {
  return `${formatMinute(startMinute)} – ${formatMinute(endMinute)}`;
}

/** "09:05" (an <input type="time"> value) -> 545. Returns null if unparseable. */
export function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 545 -> "09:05", for populating <input type="time">. */
export function toTimeInput(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "in 2 hours", "in 25 minutes", "tomorrow", "in 3 days" */
export function humanizeGap(minutesAway: number): string {
  if (minutesAway <= 0) return "now";
  if (minutesAway < 60) return `in ${minutesAway} minute${minutesAway === 1 ? "" : "s"}`;
  if (minutesAway < 24 * 60) {
    const hours = Math.round(minutesAway / 60);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(minutesAway / (24 * 60));
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

/** Parse the ISO / SQLite datetimes the database stores. Null when unusable. */
export function parseStored(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Fri, 3 Oct" — the campus-time date a student needs to remember. */
export function formatDate(value: Date | string | null | undefined): string {
  const date = value instanceof Date ? value : parseStored(value ?? null);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: CAMPUS_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "Fri, 3 Oct, 5:00 PM" — used when the exact hour matters. */
export function formatDateTime(value: Date | string | null | undefined): string {
  const date = value instanceof Date ? value : parseStored(value ?? null);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: CAMPUS_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
