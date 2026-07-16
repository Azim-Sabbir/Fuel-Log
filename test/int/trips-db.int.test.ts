import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb } from "./helpers";
import {
  upsertUserByGoogleSub,
  createVehicle,
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
  createFuelEntry,
  createServiceEntry,
  listFuelEntriesByTrip,
  listServiceEntriesByTrip,
  listFuelEntries,
} from "../../lib/db";

const NOW = new Date().toISOString();
beforeEach(resetDb);

async function setup(sub = "g1") {
  const u = await upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
  const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
  return { u, v };
}

describe("trips (user-scoped)", () => {
  it("creates, lists, gets, updates", async () => {
    const { u, v } = await setup();
    const t = await createTrip(env.DB, u.id, {
      vehicleId: v.id,
      name: "Cox's Bazar",
      category: "vacation",
      now: NOW,
    });
    expect(t.name).toBe("Cox's Bazar");
    expect(t.category).toBe("vacation");
    expect(await listTrips(env.DB, u.id, v.id)).toHaveLength(1);
    expect((await getTrip(env.DB, u.id, t.id))?.id).toBe(t.id);

    const upd = await updateTrip(env.DB, u.id, t.id, { name: "Cox Bazar" });
    expect(upd?.name).toBe("Cox Bazar");
    expect(upd?.category).toBe("vacation"); // untouched
  });

  it("assigns entries at creation and lists them by trip", async () => {
    const { u, v } = await setup();
    const t = await createTrip(env.DB, u.id, { vehicleId: v.id, name: "Trip", now: NOW });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      tripId: t.id,
      now: NOW,
    });
    await createServiceEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-02",
      odometer: 1100,
      type: "Oil",
      cost: 800,
      tripId: t.id,
      now: NOW,
    });
    expect(await listFuelEntriesByTrip(env.DB, u.id, t.id)).toHaveLength(1);
    expect(await listServiceEntriesByTrip(env.DB, u.id, t.id)).toHaveLength(1);
  });

  it("deleteTrip nulls entries' trip_id but keeps the entries", async () => {
    const { u, v } = await setup();
    const t = await createTrip(env.DB, u.id, { vehicleId: v.id, name: "Trip", now: NOW });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      tripId: t.id,
      now: NOW,
    });
    expect(await deleteTrip(env.DB, u.id, t.id)).toBe(1);
    expect(await getTrip(env.DB, u.id, t.id)).toBeNull();
    expect(await listFuelEntriesByTrip(env.DB, u.id, t.id)).toHaveLength(0);

    const all = await listFuelEntries(env.DB, u.id, v.id);
    expect(all).toHaveLength(1);
    expect(all[0].trip_id).toBeNull();
  });

  it("does not leak or mutate another user's trip", async () => {
    const a = await setup("a");
    const b = await setup("b");
    const t = await createTrip(env.DB, a.u.id, { vehicleId: a.v.id, name: "A trip", now: NOW });
    expect(await getTrip(env.DB, b.u.id, t.id)).toBeNull();
    expect(await updateTrip(env.DB, b.u.id, t.id, { name: "x" })).toBeNull();
    expect(await deleteTrip(env.DB, b.u.id, t.id)).toBe(0);
  });
});
