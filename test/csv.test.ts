import { describe, it, expect } from "vitest";
import { toCSV, parseCSV } from "../public/lib/csv.js";

describe("toCSV", () => {
  it("writes a header row and quotes fields with commas/quotes", () => {
    const csv = toCSV(
      [
        { a: 1, b: "x,y" },
        { a: 2, b: 'he said "hi"' },
      ],
      ["a", "b"]
    );
    expect(csv).toBe('a,b\n1,"x,y"\n2,"he said ""hi"""');
  });

  it("renders null/undefined as empty", () => {
    expect(toCSV([{ a: null, b: undefined }], ["a", "b"])).toBe("a,b\n,");
  });
});

describe("parseCSV", () => {
  it("parses quoted fields with embedded commas", () => {
    expect(parseCSV('date,cost\n2026-01-01,3000\n2026-02-01,"2,500"')).toEqual([
      { date: "2026-01-01", cost: "3000" },
      { date: "2026-02-01", cost: "2,500" },
    ]);
  });

  it("handles CRLF line endings and a trailing newline", () => {
    expect(parseCSV("a,b\r\n1,2\r\n")).toEqual([{ a: "1", b: "2" }]);
  });

  it("empty input → []", () => {
    expect(parseCSV("")).toEqual([]);
  });
});

describe("roundtrip", () => {
  it("survives toCSV → parseCSV", () => {
    const rows = [
      { date: "2026-01-01", location: "Padma, Mirpur", notes: 'say "hi"' },
      { date: "2026-02-01", location: "Jamuna", notes: "" },
    ];
    const cols = ["date", "location", "notes"];
    expect(parseCSV(toCSV(rows, cols))).toEqual(rows);
  });
});
