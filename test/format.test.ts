import { describe, it, expect } from "vitest";
import { fmtBDT, fmtKm, fmtKmPerL, fmtLiters } from "../public/lib/format.js";

describe("fmtBDT", () => {
  it("prefixes the taka sign and groups thousands (0 decimals)", () => {
    expect(fmtBDT(3000)).toBe("৳3,000");
    expect(fmtBDT(4238.4)).toBe("৳4,238");
    expect(fmtBDT(0)).toBe("৳0");
  });
});

describe("fmtKm", () => {
  it("groups thousands and suffixes km", () => {
    expect(fmtKm(56248)).toBe("56,248 km");
    expect(fmtKm(0)).toBe("0 km");
  });
});

describe("fmtKmPerL", () => {
  it("shows one decimal with unit, em-dash when null", () => {
    expect(fmtKmPerL(10)).toBe("10.0 km/L");
    expect(fmtKmPerL(6.666)).toBe("6.7 km/L");
    expect(fmtKmPerL(null)).toBe("—");
  });
});

describe("fmtLiters", () => {
  it("shows up to two decimals with L", () => {
    expect(fmtLiters(30)).toBe("30 L");
    expect(fmtLiters(29.5)).toBe("29.5 L");
  });
});
