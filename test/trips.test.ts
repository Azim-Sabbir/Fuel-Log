import { describe, it, expect } from "vitest";
import { tripSummary } from "../public/lib/trips.js";

describe("tripSummary", () => {
  it("distance is the odometer span, cost is the sum", () => {
    expect(
      tripSummary([
        { odometer: 50000, cost: 3500 },
        { odometer: 50450, cost: 3300 },
        { odometer: 50900, cost: 1800 },
      ])
    ).toEqual({ count: 3, distance: 900, totalCost: 8600 });
  });

  it("a single item has zero distance", () => {
    expect(tripSummary([{ odometer: 50000, cost: 3500 }])).toEqual({
      count: 1,
      distance: 0,
      totalCost: 3500,
    });
  });

  it("empty → zeros", () => {
    expect(tripSummary([])).toEqual({ count: 0, distance: 0, totalCost: 0 });
  });

  it("tolerates missing costs", () => {
    expect(tripSummary([{ odometer: 100 }, { odometer: 300, cost: 500 }])).toEqual({
      count: 2,
      distance: 200,
      totalCost: 500,
    });
  });
});
