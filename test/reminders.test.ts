import { describe, it, expect } from "vitest";
import { reminderStatus } from "../public/lib/reminders.js";

const TH = { km: 500, days: 14 };

describe("reminderStatus", () => {
  it("ok when far from due on both km and days", () => {
    const r = {
      interval_km: 5000,
      interval_days: 180,
      last_done_odometer: 50000,
      last_done_date: "2026-01-01",
    };
    const s = reminderStatus(r, { odometer: 51000, date: "2026-02-01" }, TH);
    expect(s.status).toBe("ok");
    expect(s.nextDueOdometer).toBe(55000);
    expect(s.remainingKm).toBe(4000);
    expect(s.nextDueDate).toBe("2026-06-30"); // 2026-01-01 + 180 days
    expect(s.remainingDays).toBe(149);
  });

  it("due_soon when within the km threshold", () => {
    const r = { interval_km: 5000, interval_days: null, last_done_odometer: 50000, last_done_date: null };
    const s = reminderStatus(r, { odometer: 54700, date: "2026-02-01" }, TH);
    expect(s.remainingKm).toBe(300);
    expect(s.remainingDays).toBeNull();
    expect(s.status).toBe("due_soon");
  });

  it("overdue when past the km interval", () => {
    const r = { interval_km: 5000, interval_days: null, last_done_odometer: 50000, last_done_date: null };
    const s = reminderStatus(r, { odometer: 55200, date: "2026-02-01" }, TH);
    expect(s.remainingKm).toBe(-200);
    expect(s.status).toBe("overdue");
  });

  it("due_soon by time even when km is fine", () => {
    const r = {
      interval_km: 5000,
      interval_days: 180,
      last_done_odometer: 50000,
      last_done_date: "2026-01-01",
    };
    const s = reminderStatus(r, { odometer: 51000, date: "2026-06-20" }, TH);
    expect(s.remainingDays).toBe(10);
    expect(s.status).toBe("due_soon");
  });

  it("ok when there are no active dimensions", () => {
    const s = reminderStatus(
      { interval_km: null, interval_days: null, last_done_odometer: null, last_done_date: null },
      { odometer: 1000, date: "2026-01-01" },
      TH
    );
    expect(s.status).toBe("ok");
    expect(s.remainingKm).toBeNull();
    expect(s.remainingDays).toBeNull();
  });
});
