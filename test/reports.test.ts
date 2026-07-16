import { describe, it, expect } from "vitest";
import { filterByDateRange, monthlySpend } from "../public/lib/reports.js";

describe("filterByDateRange", () => {
  it("keeps items whose date is within [from, to] inclusive", () => {
    const items = [{ date: "2026-01-15" }, { date: "2026-02-01" }, { date: "2026-03-10" }];
    expect(filterByDateRange(items, "2026-02-01", "2026-02-28")).toEqual([{ date: "2026-02-01" }]);
  });
});

describe("monthlySpend", () => {
  it("groups fuel + service cost by month, sorted ascending", () => {
    const fuel = [
      { date: "2026-01-10", cost: 3000 },
      { date: "2026-01-20", cost: 2000 },
      { date: "2026-02-05", cost: 2500 },
    ];
    const service = [
      { date: "2026-01-15", cost: 1500 },
      { date: "2026-03-01", cost: 800 },
    ];
    expect(monthlySpend(fuel, service)).toEqual([
      { month: "2026-01", fuel: 5000, service: 1500, total: 6500 },
      { month: "2026-02", fuel: 2500, service: 0, total: 2500 },
      { month: "2026-03", fuel: 0, service: 800, total: 800 },
    ]);
  });

  it("returns [] when there is nothing", () => {
    expect(monthlySpend([], [])).toEqual([]);
  });
});
