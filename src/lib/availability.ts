import {
  campusNow,
  humanizeGap,
  formatRange,
  formatDate,
  formatDateTime,
  parseStored,
  WEEKDAYS,
  type CampusNow,
} from "./time";

/**
 * Availability resolution — the one piece of logic that defines what FIND promises.
 *
 * FIND is an information system, NOT a tracking system. There is no sensor, no
 * check-in scan, no device lookup. A status can only come from two places:
 *
 *   1. the office-hours schedule the faculty member published  ("expected in office")
 *   2. a status the faculty member voluntarily posted           ("confirmed by them")
 *
 * A posted status always wins while it is unexpired, because the person knows
 * more than their schedule does. Otherwise we report the schedule and label it
 * as such, so a student can tell "the timetable says so" apart from "they said so".
 *
 * A posted status that runs longer than a day is an ABSENCE OVERRIDE: the
 * "away for a week / a month" case. It reads differently to a student, because
 * what they need is not "not now" but "not until the 3rd", so it is labelled
 * Away and always carries its return date.
 */

export type AvailabilityState =
  | "available" // green  — faculty confirmed they are in / reachable
  | "office_hours" // amber  — inside a published office-hours window
  | "unavailable" // red    — faculty confirmed they are away
  | "outside_hours" // gray   — has a schedule, but nothing open right now
  | "no_schedule"; // gray   — no office hours published at all

export type AvailabilitySource = "faculty" | "schedule" | "none";

export type ScheduleType = "office" | "consultation" | "class";

const SCHEDULE_TYPES: readonly ScheduleType[] = ["office", "consultation", "class"];

/** Narrow an untrusted string (a URL param, form value) to a ScheduleType, or undefined. */
export function parseScheduleType(value: string | null | undefined): ScheduleType | undefined {
  return (SCHEDULE_TYPES as readonly string[]).includes(value ?? "")
    ? (value as ScheduleType)
    : undefined;
}

export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  office: "Office hours",
  consultation: "Consultation hours",
  class: "Class hours",
};

/** The in-progress phrasing: "In office hours" / "In consultation hours" / "In class". */
export const SCHEDULE_TYPE_IN_LABEL: Record<ScheduleType, string> = {
  office: "In office hours",
  consultation: "In consultation hours",
  class: "In class",
};

export type OfficeHour = {
  weekday: number;
  start_minute: number;
  end_minute: number;
  type?: ScheduleType;
  location_note?: string;
};

export type ManualStatus = {
  manual_status?: string | null;
  manual_note?: string | null;
  manual_until?: string | null;
  manual_set_at?: string | null;
};

export type Availability = {
  state: AvailabilityState;
  /** Where the claim came from — shown to students so they can judge it. */
  source: AvailabilitySource;
  label: string;
  dot: "green" | "amber" | "red" | "gray";
  /** One sentence a student can act on. */
  detail: string;
  /** Set when a window is open right now. */
  currentWindow: OfficeHour | null;
  /** The next window that opens, searching up to 7 days ahead. */
  nextWindow: (OfficeHour & { minutesAway: number }) | null;
  /** Faculty's own note, if they left one. */
  note: string;
  /** Which kind of block is active/next, when the state came from the schedule. */
  scheduleType: ScheduleType | null;
  /** True when the faculty member posted this themselves. */
  selfReported: boolean;
  /** ISO datetime the posted status runs until, when one was given. */
  until: string | null;
  /** True when the override spans more than a day — an absence, not a moment. */
  longAbsence: boolean;
};

const MINUTES_PER_DAY = 1440;
const A_DAY_MS = 24 * 60 * 60 * 1000;

const MANUAL_STATES = new Set(["available", "unavailable", "office_hours"]);

function activeManual(manual: ManualStatus, now: Date): { until: Date | null } | null {
  if (!manual.manual_status || !MANUAL_STATES.has(manual.manual_status)) return null;
  const until = parseStored(manual.manual_until);
  if (!until) return { until: null }; // no expiry — stands until cleared
  return until.getTime() > now.getTime() ? { until } : null;
}

/** The window containing `now`, if any. */
export function findCurrentWindow(hours: OfficeHour[], now: CampusNow): OfficeHour | null {
  return (
    hours.find(
      (h) =>
        h.weekday === now.weekday && now.minute >= h.start_minute && now.minute < h.end_minute,
    ) ?? null
  );
}

/** The soonest window strictly after `now`, searching a full week forward. */
export function findNextWindow(
  hours: OfficeHour[],
  now: CampusNow,
): (OfficeHour & { minutesAway: number }) | null {
  let best: (OfficeHour & { minutesAway: number }) | null = null;

  for (const h of hours) {
    // How many whole days until this weekday comes around again.
    const dayOffset = (h.weekday - now.weekday + 7) % 7;
    let minutesAway = dayOffset * MINUTES_PER_DAY + h.start_minute - now.minute;
    // Already started or passed today — roll it to next week.
    if (minutesAway <= 0) minutesAway += 7 * MINUTES_PER_DAY;
    if (!best || minutesAway < best.minutesAway) best = { ...h, minutesAway };
  }

  return best;
}

export function resolveAvailability(
  hours: OfficeHour[],
  manual: ManualStatus = {},
  at: Date = new Date(),
): Availability {
  const now = campusNow(at);
  const sorted = [...hours].sort(
    (a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute,
  );
  const currentWindow = findCurrentWindow(sorted, now);
  const nextWindow = findNextWindow(sorted, now);
  const note = (manual.manual_note ?? "").trim();

  const nextSentence = nextWindow
    ? `Next office hours ${WEEKDAYS[nextWindow.weekday]}, ${formatRange(
        nextWindow.start_minute,
        nextWindow.end_minute,
      )} (${humanizeGap(nextWindow.minutesAway)}).`
    : "No office hours are published yet.";

  const active = activeManual(manual, at);

  if (active) {
    const state = manual.manual_status as AvailabilityState;
    const until = active.until;
    const untilIso = until ? until.toISOString() : null;
    // More than a day out is an absence, not a passing status.
    const longAbsence = Boolean(until && until.getTime() - at.getTime() > A_DAY_MS);
    const base = {
      source: "faculty" as const,
      currentWindow,
      nextWindow,
      note,
      scheduleType: currentWindow?.type ?? null,
      selfReported: true,
      until: untilIso,
      longAbsence,
    };

    if (state === "available") {
      return {
        ...base,
        state,
        label: "Available",
        dot: "green",
        detail: note || "Posted as available for consultation right now.",
      };
    }

    if (state === "unavailable") {
      // The one thing a student actually needs from a long absence is the date
      // they can come back, so it leads — before any note.
      const returns = longAbsence
        ? `Away until ${formatDate(until)}.`
        : until
          ? `Away until ${formatDateTime(until)}.`
          : "Posted as away.";
      return {
        ...base,
        state,
        label: longAbsence ? "Away" : "Unavailable",
        dot: "red",
        detail: note ? `${returns} ${note}` : `${returns} ${nextSentence}`,
      };
    }

    return {
      ...base,
      state: "office_hours",
      label: base.scheduleType ? SCHEDULE_TYPE_IN_LABEL[base.scheduleType] : "In office hours",
      dot: "amber",
      detail: note || "Holding hours — students may drop by.",
    };
  }

  const scheduled = {
    source: "schedule" as const,
    note,
    scheduleType: null as ScheduleType | null,
    selfReported: false,
    until: null,
    longAbsence: false,
  };

  if (currentWindow) {
    const type = currentWindow.type ?? "office";
    return {
      ...scheduled,
      state: "office_hours",
      label: SCHEDULE_TYPE_IN_LABEL[type],
      dot: "amber",
      scheduleType: type,
      detail: `Scheduled ${SCHEDULE_TYPE_LABEL[type].toLowerCase()} until ${formatRange(
        currentWindow.start_minute,
        currentWindow.end_minute,
      ).split(" – ")[1]}. Expected ${type === "class" ? "in class" : "in office"} — not confirmed by them.`,
      currentWindow,
      nextWindow,
    };
  }

  if (sorted.length === 0) {
    return {
      ...scheduled,
      state: "no_schedule",
      source: "none",
      label: "No schedule posted",
      dot: "gray",
      detail: "This faculty member has not published office hours. Contact the department office.",
      currentWindow: null,
      nextWindow: null,
    };
  }

  return {
    ...scheduled,
    state: "outside_hours",
    label: "Outside office hours",
    dot: "gray",
    detail: nextSentence,
    currentWindow: null,
    nextWindow,
  };
}

/** Does this faculty member's schedule/status mean a student could go now? */
export function isOpenNow(availability: Availability): boolean {
  return availability.state === "available" || availability.state === "office_hours";
}
