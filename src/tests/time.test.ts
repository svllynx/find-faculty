import { describe, expect, it } from "vitest";
import { campusNow, formatMinute, formatRange, humanizeGap, parseTimeInput, toTimeInput } from "../lib/time";

describe("formatMinute", () => {
  it("formats midnight and noon without a zero hour", () => {
    expect(formatMinute(0)).toBe("12:00 AM");
    expect(formatMinute(720)).toBe("12:00 PM");
  });

  it("formats morning and afternoon times", () => {
    expect(formatMinute(540)).toBe("9:00 AM");
    expect(formatMinute(545)).toBe("9:05 AM");
    expect(formatMinute(13 * 60)).toBe("1:00 PM");
    expect(formatMinute(23 * 60 + 59)).toBe("11:59 PM");
  });

  it("wraps out-of-range minutes instead of producing nonsense", () => {
    expect(formatMinute(1440)).toBe("12:00 AM");
    expect(formatMinute(-60)).toBe("11:00 PM");
  });
});

describe("formatRange", () => {
  it("renders the example from the FIND brief", () => {
    expect(formatRange(540, 660)).toBe("9:00 AM – 11:00 AM");
    expect(formatRange(13 * 60, 15 * 60)).toBe("1:00 PM – 3:00 PM");
  });
});

describe("parseTimeInput / toTimeInput", () => {
  it("round-trips an input value", () => {
    expect(parseTimeInput("09:05")).toBe(545);
    expect(toTimeInput(545)).toBe("09:05");
    expect(toTimeInput(parseTimeInput("13:30")!)).toBe("13:30");
  });

  it("rejects malformed or impossible times", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("9am")).toBeNull();
    expect(parseTimeInput("25:00")).toBeNull();
    expect(parseTimeInput("10:75")).toBeNull();
  });
});

describe("campusNow", () => {
  it("reads weekday and minute in the campus timezone, not the server one", () => {
    // 2026-09-07T01:30:00Z is Monday 09:30 in Asia/Manila (+08).
    const now = campusNow(new Date("2026-09-07T01:30:00Z"), "Asia/Manila");
    expect(now.weekday).toBe(1);
    expect(now.minute).toBe(9 * 60 + 30);
  });

  it("rolls the weekday over when the campus day is ahead of UTC", () => {
    // Sunday 20:00 UTC is already Monday 04:00 in Manila.
    const now = campusNow(new Date("2026-09-06T20:00:00Z"), "Asia/Manila");
    expect(now.weekday).toBe(1);
    expect(now.minute).toBe(4 * 60);
  });

  it("reports minute 0 rather than 1440 at campus midnight", () => {
    const now = campusNow(new Date("2026-09-06T16:00:00Z"), "Asia/Manila");
    expect(now.minute).toBe(0);
  });
});

describe("humanizeGap", () => {
  it("scales the wording to the size of the gap", () => {
    expect(humanizeGap(0)).toBe("now");
    expect(humanizeGap(1)).toBe("in 1 minute");
    expect(humanizeGap(25)).toBe("in 25 minutes");
    expect(humanizeGap(120)).toBe("in 2 hours");
    expect(humanizeGap(60 * 24)).toBe("tomorrow");
    expect(humanizeGap(60 * 24 * 3)).toBe("in 3 days");
  });
});
