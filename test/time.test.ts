import { describe, it, expect } from "vitest";
import { todayDate, shiftDate, daysBetween } from "../lib/time";

describe("time helpers (Dhaka = UTC+6, no DST)", () => {
  it("todayDate converts a UTC instant to the Dhaka calendar date", () => {
    // 09:00 Dhaka
    expect(todayDate(new Date("2026-07-16T03:00:00Z"))).toBe("2026-07-16");
    // 02:00 the next day in Dhaka
    expect(todayDate(new Date("2026-07-16T20:00:00Z"))).toBe("2026-07-17");
  });

  it("shiftDate moves a YYYY-MM-DD string by N days across month/year boundaries", () => {
    expect(shiftDate("2026-07-16", -1)).toBe("2026-07-15");
    expect(shiftDate("2026-07-16", 30)).toBe("2026-08-15");
    expect(shiftDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("daysBetween counts signed calendar days from a to b", () => {
    expect(daysBetween("2026-07-01", "2026-07-16")).toBe(15);
    expect(daysBetween("2026-07-16", "2026-07-01")).toBe(-15);
    expect(daysBetween("2026-07-16", "2026-07-16")).toBe(0);
  });
});
