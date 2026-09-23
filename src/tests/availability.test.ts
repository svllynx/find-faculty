import { describe, expect, it } from "vitest";
import { findNextWindow, isOpenNow, resolveAvailability, type OfficeHour } from "../lib/availability";
import { campusNow } from "../lib/time";

// All fixtures use Asia/Manila (UTC+8), the default campus timezone.
const MONDAY_10AM = new Date("2026-09-07T02:00:00Z"); // Mon 10:00 campus
const MONDAY_2PM = new Date("2026-09-07T06:00:00Z"); // Mon 14:00 campus
const SUNDAY_9AM = new Date("2026-09-06T01:00:00Z"); // Sun 09:00 campus

const santosHours: OfficeHour[] = [
  { weekday: 1, start_minute: 13 * 60, end_minute: 15 * 60 }, // Mon 1-3 PM
  { weekday: 3, start_minute: 13 * 60, end_minute: 15 * 60 }, // Wed 1-3 PM
  { weekday: 5, start_minute: 9 * 60, end_minute: 11 * 60 }, // Fri 9-11 AM
];

describe("resolveAvailability — schedule only", () => {
  it("is amber and inside a window during office hours", () => {
    const a = resolveAvailability(santosHours, {}, MONDAY_2PM);
    expect(a.state).toBe("office_hours");
    expect(a.dot).toBe("amber");
    expect(a.source).toBe("schedule");
    expect(a.currentWindow?.weekday).toBe(1);
    expect(isOpenNow(a)).toBe(true);
  });

  it("labels a schedule-derived status as expected, not confirmed", () => {
    const a = resolveAvailability(santosHours, {}, MONDAY_2PM);
    expect(a.selfReported).toBe(false);
    expect(a.detail).toMatch(/not confirmed by them/i);
  });

  it("is gray outside a window and names the next one", () => {
    const a = resolveAvailability(santosHours, {}, MONDAY_10AM);
    expect(a.state).toBe("outside_hours");
    expect(a.dot).toBe("gray");
    expect(a.currentWindow).toBeNull();
    expect(a.nextWindow?.weekday).toBe(1);
    expect(a.nextWindow?.minutesAway).toBe(3 * 60); // 10 AM -> 1 PM
    expect(a.detail).toContain("Monday");
    expect(isOpenNow(a)).toBe(false);
  });

  it("treats the end minute as exclusive so a window closes on time", () => {
    const atThree = new Date("2026-09-07T07:00:00Z"); // Mon 15:00 exactly
    expect(resolveAvailability(santosHours, {}, atThree).state).toBe("outside_hours");
    const justBefore = new Date("2026-09-07T06:59:00Z"); // Mon 14:59
    expect(resolveAvailability(santosHours, {}, justBefore).state).toBe("office_hours");
  });

  it("reports no_schedule when nothing has been published", () => {
    const a = resolveAvailability([], {}, MONDAY_2PM);
    expect(a.state).toBe("no_schedule");
    expect(a.nextWindow).toBeNull();
    expect(a.detail).toMatch(/department office/i);
  });
});

describe("resolveAvailability — voluntary status overrides", () => {
  it("green when the faculty member posted availability", () => {
    const a = resolveAvailability(
      santosHours,
      { manual_status: "available", manual_note: "In my office grading." },
      MONDAY_10AM,
    );
    expect(a.state).toBe("available");
    expect(a.dot).toBe("green");
    expect(a.source).toBe("faculty");
    expect(a.selfReported).toBe(true);
    expect(a.detail).toBe("In my office grading.");
  });

  it("red beats the schedule — a posted absence wins over the timetable", () => {
    const a = resolveAvailability(
      santosHours,
      { manual_status: "unavailable", manual_note: "Out for a meeting." },
      MONDAY_2PM, // inside a scheduled window
    );
    expect(a.state).toBe("unavailable");
    expect(a.dot).toBe("red");
    expect(a.detail).toContain("Out for a meeting.");
    expect(isOpenNow(a)).toBe(false);
  });

  it("falls back to the schedule once the posted status expires", () => {
    const manual = {
      manual_status: "unavailable",
      manual_until: new Date("2026-09-07T05:00:00Z").toISOString(), // expires Mon 13:00
    };
    expect(resolveAvailability(santosHours, manual, new Date("2026-09-07T04:00:00Z")).state).toBe(
      "unavailable",
    );
    // Mon 14:00, after expiry and inside the 1-3 PM block.
    expect(resolveAvailability(santosHours, manual, MONDAY_2PM).state).toBe("office_hours");
  });

  it("honours a status with no expiry until it is cleared", () => {
    const manual = { manual_status: "available", manual_until: null };
    expect(resolveAvailability(santosHours, manual, SUNDAY_9AM).state).toBe("available");
  });

  it("ignores an unknown status value rather than trusting it", () => {
    const a = resolveAvailability(santosHours, { manual_status: "on_leave_forever" }, MONDAY_2PM);
    expect(a.state).toBe("office_hours");
    expect(a.source).toBe("schedule");
  });

  it("still exposes the schedule alongside a posted status", () => {
    const a = resolveAvailability(santosHours, { manual_status: "unavailable" }, MONDAY_2PM);
    expect(a.currentWindow?.start_minute).toBe(13 * 60);
    expect(a.nextWindow).not.toBeNull();
  });
});

describe("findNextWindow", () => {
  it("wraps to next week when every window for today has passed", () => {
    const fridayNoon = campusNow(new Date("2026-09-11T04:00:00Z")); // Fri 12:00
    const next = findNextWindow(santosHours, fridayNoon);
    expect(next?.weekday).toBe(1); // Monday
    expect(next?.minutesAway).toBe(3 * 24 * 60 + 60); // Fri 12:00 -> Mon 13:00
  });

  it("prefers a later block on the same day over one next week", () => {
    const hours: OfficeHour[] = [
      { weekday: 1, start_minute: 8 * 60, end_minute: 9 * 60 },
      { weekday: 1, start_minute: 16 * 60, end_minute: 17 * 60 },
    ];
    const next = findNextWindow(hours, campusNow(MONDAY_10AM));
    expect(next?.start_minute).toBe(16 * 60);
    expect(next?.minutesAway).toBe(6 * 60);
  });

  it("returns null when there are no windows at all", () => {
    expect(findNextWindow([], campusNow(MONDAY_10AM))).toBeNull();
  });
});

describe("resolveAvailability — absence overrides", () => {
  const away = (untilIso: string | null, note = "") => ({
    manual_status: "unavailable",
    manual_note: note,
    manual_until: untilIso,
  });

  const daysFrom = (base: Date, days: number) =>
    new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  it("reads as Away, not Unavailable, once it runs past a day", () => {
    const a = resolveAvailability(santosHours, away(daysFrom(MONDAY_2PM, 7)), MONDAY_2PM);
    expect(a.label).toBe("Away");
    expect(a.longAbsence).toBe(true);
    expect(a.dot).toBe("red");
  });

  it("leads with the date they are back, before any note", () => {
    const a = resolveAvailability(
      santosHours,
      away(daysFrom(MONDAY_2PM, 30), "On study leave."),
      MONDAY_2PM,
    );
    expect(a.detail).toMatch(/^Away until /);
    expect(a.detail).toContain("On study leave.");
  });

  it("stays Unavailable for a short absence", () => {
    const a = resolveAvailability(santosHours, away(daysFrom(MONDAY_2PM, 0.1)), MONDAY_2PM);
    expect(a.label).toBe("Unavailable");
    expect(a.longAbsence).toBe(false);
  });

  it("exposes the end of the override so the UI can repeat it", () => {
    const until = daysFrom(MONDAY_2PM, 7);
    const a = resolveAvailability(santosHours, away(until), MONDAY_2PM);
    expect(a.until).toBe(new Date(until).toISOString());
  });

  it("lapses on its own — the schedule comes back the day after it ends", () => {
    const until = daysFrom(MONDAY_2PM, 7);
    const after = new Date(new Date(until).getTime() + 60_000);
    const a = resolveAvailability(santosHours, away(until), after);
    expect(a.selfReported).toBe(false);
    expect(a.label).not.toBe("Away");
  });

  it("has no end date when nothing was posted", () => {
    const a = resolveAvailability(santosHours, {}, MONDAY_2PM);
    expect(a.until).toBeNull();
    expect(a.longAbsence).toBe(false);
  });

  it("an open-ended override is not treated as a dated absence", () => {
    const a = resolveAvailability(santosHours, away(null), MONDAY_2PM);
    expect(a.label).toBe("Unavailable");
    expect(a.longAbsence).toBe(false);
    expect(a.until).toBeNull();
  });
});
