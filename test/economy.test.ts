import { describe, it, expect } from "vitest";
import {
  pricePerLiter,
  computeEntries,
  summarize,
  tripCostEstimate,
} from "../public/lib/economy.js";

// A clean 3-fill history for one vehicle, oldest first:
//   full baseline @1000 (30L) → partial @1300 (20L) → full @1600 (40L)
// The closed segment 1000→1600 covers 600 km on the 20L partial + 40L refill = 60L → 10 km/L.
const history = [
  { date: "2026-01-01", odometer: 1000, volume: 30, cost: 3000, isFull: true },
  { date: "2026-01-10", odometer: 1300, volume: 20, cost: 2000, isFull: false },
  { date: "2026-01-20", odometer: 1600, volume: 40, cost: 4000, isFull: true },
];

describe("pricePerLiter", () => {
  it("divides cost by volume", () => {
    expect(pricePerLiter({ volume: 40, cost: 4000 })).toBe(100);
  });
  it("is null when volume is zero", () => {
    expect(pricePerLiter({ volume: 0, cost: 4000 })).toBeNull();
  });
});

describe("computeEntries (trip distance + full-to-full km/L)", () => {
  it("derives trip distance and km/L, skipping partial fills", () => {
    const out = computeEntries(history);
    expect(out[0].tripDistance).toBeNull(); // first entry has no prior odometer
    expect(out[0].kmPerL).toBeNull(); // baseline full has no prior full to measure from

    expect(out[1].tripDistance).toBe(300);
    expect(out[1].kmPerL).toBeNull(); // partial fill → no economy

    expect(out[2].tripDistance).toBe(300);
    expect(out[2].kmPerL).toBe(10); // (1600-1000) / (20+40)
  });

  it("computes km/L for consecutive full tanks with no partials", () => {
    const out = computeEntries([
      { date: "2026-02-01", odometer: 0, volume: 25, cost: 2500, isFull: true },
      { date: "2026-02-05", odometer: 300, volume: 30, cost: 3000, isFull: true },
    ]);
    expect(out[1].kmPerL).toBe(10); // 300 km / 30 L
  });

  it("returns [] for empty input", () => {
    expect(computeEntries([])).toEqual([]);
  });
});

describe("summarize", () => {
  it("totals distance/liters/cost and averages economy over measured segments only", () => {
    expect(summarize(history)).toEqual({
      entries: 3,
      totalDistance: 600, // 1600 - 1000
      totalLiters: 90, // 30 + 20 + 40
      totalCost: 9000, // 3000 + 2000 + 4000
      avgKmPerL: 10, // measured distance 600 / measured liters 60
      avgPricePerLiter: 100, // 9000 / 90
    });
  });

  it("returns zeros and null economy for empty input", () => {
    expect(summarize([])).toEqual({
      entries: 0,
      totalDistance: 0,
      totalLiters: 0,
      totalCost: 0,
      avgKmPerL: null,
      avgPricePerLiter: null,
    });
  });

  it("has null economy when there is only one fill", () => {
    const s = summarize([{ date: "2026-03-01", odometer: 500, volume: 20, cost: 2000, isFull: true }]);
    expect(s.totalDistance).toBe(0);
    expect(s.avgKmPerL).toBeNull();
  });
});

describe("tripCostEstimate", () => {
  it("estimates fuel cost from distance, economy, and price", () => {
    expect(tripCostEstimate({ distance: 450, kmPerL: 15, pricePerL: 100 })).toBe(3000);
  });
  it("is null when economy is missing or zero", () => {
    expect(tripCostEstimate({ distance: 450, kmPerL: 0, pricePerL: 100 })).toBeNull();
    expect(tripCostEstimate({ distance: 450, kmPerL: null, pricePerL: 100 })).toBeNull();
  });
});
