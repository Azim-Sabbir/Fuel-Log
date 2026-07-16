import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb } from "./helpers";
import {
  upsertUserByGoogleSub,
  createVehicle,
  createServiceEntry,
  listServiceEntries,
  getServiceEntry,
  updateServiceEntry,
  deleteServiceEntry,
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
  deleteVehicle,
} from "../../lib/db";

const NOW = new Date().toISOString();
beforeEach(resetDb);

async function setup(sub = "g1") {
  const u = await upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
  const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
  return { u, v };
}

describe("service entries (user-scoped)", () => {
  it("creates, lists oldest-first, updates, deletes; other users can't touch", async () => {
    const { u, v } = await setup();
    const other = await upsertUserByGoogleSub(env.DB, { googleSub: "o", email: "o@b.com", now: NOW });

    await createServiceEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-03-01",
      odometer: 52000,
      type: "Oil change",
      cost: 1500,
      now: NOW,
    });
    await createServiceEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-10",
      odometer: 50000,
      type: "Tire rotation",
      cost: 800,
      now: NOW,
    });

    const list = await listServiceEntries(env.DB, u.id, v.id);
    expect(list.map((s) => s.date)).toEqual(["2026-01-10", "2026-03-01"]);

    const first = list[0];
    expect((await getServiceEntry(env.DB, u.id, first.id))?.type).toBe("Tire rotation");
    expect(await getServiceEntry(env.DB, other.id, first.id)).toBeNull();

    const upd = await updateServiceEntry(env.DB, u.id, first.id, { cost: 900 });
    expect(upd?.cost).toBe(900);
    expect(await updateServiceEntry(env.DB, other.id, first.id, { cost: 1 })).toBeNull();

    expect(await deleteServiceEntry(env.DB, other.id, first.id)).toBe(0);
    expect(await deleteServiceEntry(env.DB, u.id, first.id)).toBe(1);
  });
});

describe("reminders (user-scoped)", () => {
  it("creates, lists, updates, deletes", async () => {
    const { u, v } = await setup();
    const r = await createReminder(env.DB, u.id, {
      vehicleId: v.id,
      type: "Oil change",
      intervalKm: 5000,
      intervalDays: 180,
      lastDoneOdometer: 50000,
      lastDoneDate: "2026-01-01",
      now: NOW,
    });
    expect(r.interval_km).toBe(5000);
    expect(await listReminders(env.DB, u.id, v.id)).toHaveLength(1);

    const upd = await updateReminder(env.DB, u.id, r.id, { lastDoneOdometer: 55000 });
    expect(upd?.last_done_odometer).toBe(55000);

    expect(await deleteReminder(env.DB, u.id, r.id)).toBe(1);
    expect(await listReminders(env.DB, u.id, v.id)).toHaveLength(0);
  });
});

describe("deleteVehicle cascade", () => {
  it("removes the vehicle's service entries and reminders too", async () => {
    const { u, v } = await setup();
    await createServiceEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-10",
      odometer: 50000,
      type: "Oil change",
      cost: 800,
      now: NOW,
    });
    await createReminder(env.DB, u.id, { vehicleId: v.id, type: "Oil change", intervalKm: 5000, now: NOW });

    await deleteVehicle(env.DB, u.id, v.id);

    expect(await listServiceEntries(env.DB, u.id, v.id)).toHaveLength(0);
    expect(await listReminders(env.DB, u.id, v.id)).toHaveLength(0);
  });
});
