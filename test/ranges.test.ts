import { describe, it, expect } from "vitest";
import { dhakaToday, shiftMonths, presetRange } from "../public/lib/ranges.js";

// Dhaka 2026-07-16 (09:00 local).
const now = new Date("2026-07-16T03:00:00Z");

describe("dhakaToday", () => {
  it("gives the Dhaka calendar date for an instant", () => {
    expect(dhakaToday(now)).toBe("2026-07-16");
    expect(dhakaToday(new Date("2026-07-16T20:00:00Z"))).toBe("2026-07-17");
  });
});

describe("shiftMonths", () => {
  it("subtracts and adds whole months", () => {
    expect(shiftMonths("2026-07-16", -3)).toBe("2026-04-16");
    expect(shiftMonths("2026-07-16", -12)).toBe("2025-07-16");
    expect(shiftMonths("2026-07-16", 2)).toBe("2026-09-16");
  });
  it("clamps the day when the target month is shorter", () => {
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("presetRange", () => {
  it("this month → 1st of the month to today", () => {
    expect(presetRange("month", now)).toEqual({ from: "2026-07-01", to: "2026-07-16" });
  });
  it("3 / 6 / 12 month windows end today", () => {
    expect(presetRange("3mo", now)).toEqual({ from: "2026-04-16", to: "2026-07-16" });
    expect(presetRange("6mo", now)).toEqual({ from: "2026-01-16", to: "2026-07-16" });
    expect(presetRange("1yr", now)).toEqual({ from: "2025-07-16", to: "2026-07-16" });
  });
  it("all → an early floor date to today", () => {
    expect(presetRange("all", now)).toEqual({ from: "1900-01-01", to: "2026-07-16" });
  });
  it("unknown preset falls back to this month", () => {
    expect(presetRange("bogus", now)).toEqual({ from: "2026-07-01", to: "2026-07-16" });
  });
});
