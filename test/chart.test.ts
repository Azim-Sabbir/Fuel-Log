import { describe, it, expect } from "vitest";
import { barGeometry, linePoints } from "../public/lib/chart.js";

describe("barGeometry", () => {
  it("scales bars to the max value, y measured from the top", () => {
    const bars = barGeometry([0, 5, 10], { width: 30, height: 100 });
    expect(bars[0]).toEqual({ x: 0, y: 100, w: 10, h: 0 });
    expect(bars[1]).toEqual({ x: 10, y: 50, w: 10, h: 50 });
    expect(bars[2]).toEqual({ x: 20, y: 0, w: 10, h: 100 });
  });

  it("empty → []; all-zero → zero heights", () => {
    expect(barGeometry([], { width: 10, height: 10 })).toEqual([]);
    expect(barGeometry([0, 0], { width: 10, height: 10 })[0].h).toBe(0);
  });
});

describe("linePoints", () => {
  it("spreads points across the width, y scaled to max", () => {
    expect(linePoints([0, 10], { width: 100, height: 50 })).toBe("0,50 100,0");
    expect(linePoints([5, 10, 0], { width: 100, height: 100 })).toBe("0,50 50,0 100,100");
  });

  it("single point sits at the left, empty → ''", () => {
    expect(linePoints([7], { width: 100, height: 50 })).toBe("0,0");
    expect(linePoints([], { width: 100, height: 50 })).toBe("");
  });
});
