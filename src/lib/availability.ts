import { campusNow, humanizeGap, formatRange, WEEKDAYS, type CampusNow } from "./time";

/**
 * Availability resolution — the one piece of logic that defines what FIND promises.
 *
 * FIND is an information system, NOT a tracking system. There is no sensor, no
 * check-in scan, no device lookup. A status can only come from two places:
 *
 *   1. the office-hours schedule the faculty member published  ("expected in office")
 *   2. a status the faculty member voluntarily posted           ("confirmed by them")
 *
 * A manual status always wins while it is unexpired, because the person knows more
 * than their schedule does. Otherwise we report the schedule and label it as such,
 * so a student can tell "the timetable says so" apart from "they said so".
 */

export type AvailabilityState =
  | "available" // green  — faculty confirmed they are in / reachable
  | "office_hours" // amber  — inside a published office-hours window
  | "unavailable" // red    — faculty confirmed they are away
  | "outside_hours" // gray   — has a schedule, but nothing open right now
  | "no_schedule"; // gray   — no office hours published at all

export type AvailabilitySource = "faculty" | "schedule" | "none";

export type OfficeHour = {
  weekday: number;
  start_minute: number;
  end_minute: number;
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
  /** True when the faculty member posted this themselves. */
  selfReported: boolean;
};

const MINUTES_PER_DAY = 1440;

const MANUAL_STATES = new Set(["available", "unavailable", "office_hours"]);

function isManualActive(manual: ManualStatus, now: Date): boolean {
  if (!manual.manual_status || !MANUAL_STATES.has(manual.manual_status)) return false;
  if (!manual.manual_until) return true; // no expiry set — stands until cleared
  const until = new Date(manual.manual_until.replace(" ", "T"));
  if (Number.isNaN(until.getTime())) return true;
  return until.getTime() > now.getTime();
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
    let dayOffset = (h.weekday - now.weekday + 7) % 7;
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

  if (isManualActive(manual, at)) {
    const state = manual.manual_status as AvailabilityState;
    if (state === "available") {
      return {
        state,
        source: "faculty",
        label: "Available",
        dot: "green",
        detail: note || "Posted as available for consultation right now.",
        currentWindow,
        nextWindow,
        note,
        selfReported: true,
      };
    }
    if (state === "unavailable") {
      return {
        state,
        source: "faculty",
        label: "Unavailable",
        dot: "red",
        detail: note || `Posted as away. ${nextSentence}`,
        currentWindow,
        nextWindow,
        note,
        selfReported: true,
      };
    }
    return {
      state: "office_hours",
      source: "faculty",
      label: "In office hours",
      dot: "amber",
      detail: note || "Holding office hours — drop by.",
      currentWindow,
      nextWindow,
      note,
      selfReported: true,
    };
  }

  if (currentWindow) {
    return {
      state: "office_hours",
      source: "schedule",
      label: "In office hours",
      dot: "amber",
      detail: `Scheduled office hours until ${formatRange(
        currentWindow.start_minute,
        currentWindow.end_minute,
      ).split(" – ")[1]}. Expected in office — not confirmed by them.`,
      currentWindow,
      nextWindow,
      note,
      selfReported: false,
    };
  }

  if (sorted.length === 0) {
    return {
      state: "no_schedule",
      source: "none",
      label: "No schedule posted",
      dot: "gray",
      detail: "This faculty member has not published office hours. Contact the department office.",
      currentWindow: null,
      nextWindow: null,
      note,
      selfReported: false,
    };
  }

  return {
    state: "outside_hours",
    source: "schedule",
    label: "Outside office hours",
    dot: "gray",
    detail: nextSentence,
    currentWindow: null,
    nextWindow,
    note,
    selfReported: false,
  };
}

/** Does this faculty member's schedule/status mean a student could go now? */
export function isOpenNow(availability: Availability): boolean {
  return availability.state === "available" || availability.state === "office_hours";
}
