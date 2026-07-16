import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestGet as exportCsv } from "../../functions/api/export";
import { onRequestPost as importCsv } from "../../functions/api/import";
import { upsertUserByGoogleSub, createVehicle, createFuelEntry, listFuelEntries } from "../../lib/db";

const NOW = new Date().toISOString();

async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
}

/** POST a raw CSV body to the import handler for a given vehicle. */
function importCtx(userId: number, vehicleId: number | string, csv: string): any {
  return {
    request: new Request(`https://x/api/import?vehicleId=${vehicleId}`, {
      method: "POST",
      body: csv,
      headers: { "Content-Type": "text/csv" },
    }),
    env,
    data: { userId },
    params: {},
  };
}

beforeEach(resetDb);

describe("GET /api/export", () => {
  it("returns a CSV with a header row plus the vehicle's rows", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      isFull: true,
      location: "Pump A",
      now: NOW,
    });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-20",
      odometer: 1600,
      volume: 40,
      cost: 4000,
      isFull: false,
      now: NOW,
    });

    const res = await exportCsv(authCtx(`/api/export?vehicleId=${v.id}`, u.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="fuel-log.csv"');

    const text = await res.text();
    const lines = text.split("\n");
    expect(lines[0]).toBe("date,odometer,volume,cost,is_full,location,notes");
    expect(lines.length).toBe(3); // header + 2 rows
    expect(lines[1]).toBe("2026-01-01,1000,30,3000,1,Pump A,");
    expect(lines[2]).toBe("2026-01-20,1600,40,4000,0,,");
  });

  it("400 without a vehicleId", async () => {
    const u = await makeUser();
    const res = await exportCsv(authCtx("/api/export", u.id));
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("vehicleId_required");
  });

  it("404 for another user's vehicle", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await exportCsv(authCtx(`/api/export?vehicleId=${v.id}`, u.id));
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe("vehicle_not_found");
  });
});

describe("POST /api/import", () => {
  it("400 without a vehicleId", async () => {
    const u = await makeUser();
    const res = await importCsv(importCtx(u.id, "", "date\n"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("vehicleId_required");
  });

  it("404 for another user's vehicle", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await importCsv(importCtx(u.id, v.id, "date\n"));
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe("vehicle_not_found");
  });

  it("creates entries and skips invalid rows", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const csv = [
      "date,odometer,volume,cost,is_full,location,notes",
      "2026-01-01,1000,30,3000,1,Pump A,hello",
      "2026-01-05,1200,25,2500,0,,",
      "bad-date,1300,20,2000,1,,", // invalid date -> skipped
      "2026-01-10,1400,0,1500,1,,", // volume not > 0 -> skipped
    ].join("\n");

    const res = await importCsv(importCtx(u.id, v.id, csv));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(2);

    const rows = await listFuelEntries(env.DB, u.id, v.id);
    expect(rows.length).toBe(2);
    expect(rows[0].date).toBe("2026-01-01");
    expect(rows[0].is_full).toBe(1);
    expect(rows[0].location).toBe("Pump A");
    expect(rows[1].is_full).toBe(0);
  });

  it("round-trips: export then import into a second vehicle yields the same count", async () => {
    const u = await makeUser();
    const v1 = await createVehicle(env.DB, u.id, { name: "Car1", now: NOW });
    const v2 = await createVehicle(env.DB, u.id, { name: "Car2", now: NOW });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v1.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      isFull: true,
      location: "Pump, A",
      notes: 'has "quotes"',
      now: NOW,
    });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v1.id,
      date: "2026-02-01",
      odometer: 1500,
      volume: 35,
      cost: 3500,
      isFull: false,
      now: NOW,
    });

    const exported = await (await exportCsv(authCtx(`/api/export?vehicleId=${v1.id}`, u.id))).text();
    const res = await importCsv(importCtx(u.id, v2.id, exported));
    const body = (await res.json()) as any;
    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(0);

    const src = await listFuelEntries(env.DB, u.id, v1.id);
    const dst = await listFuelEntries(env.DB, u.id, v2.id);
    expect(dst.length).toBe(src.length);
    expect(dst.map((e) => [e.date, e.odometer, e.volume, e.cost, e.is_full])).toEqual(
      src.map((e) => [e.date, e.odometer, e.volume, e.cost, e.is_full])
    );
    // fields with commas/quotes survive the CSV round-trip
    expect(dst[0].location).toBe("Pump, A");
    expect(dst[0].notes).toBe('has "quotes"');
  });
});
