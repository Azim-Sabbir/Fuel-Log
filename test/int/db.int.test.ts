import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb } from "./helpers";
import {
  upsertUserByGoogleSub,
  createAuthSession,
  getUserBySessionHash,
  deleteAuthSession,
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
  createFuelEntry,
  listFuelEntries,
  getFuelEntry,
  updateFuelEntry,
  deleteFuelEntry,
} from "../../lib/db";

const NOW = "2026-07-16T03:00:00.000Z";

beforeEach(resetDb);

async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, {
    googleSub: sub,
    email: `${sub}@b.com`,
    name: "A",
    picture: null,
    now: NOW,
  });
}

describe("users + sessions", () => {
  it("upserts by google_sub — second call updates the same row", async () => {
    const u1 = await makeUser();
    expect(u1.id).toBeGreaterThan(0);
    const u2 = await upsertUserByGoogleSub(env.DB, {
      googleSub: "g1",
      email: "new@b.com",
      name: "A2",
      picture: "p2",
      now: NOW,
    });
    expect(u2.id).toBe(u1.id);
    expect(u2.email).toBe("new@b.com");
    expect(u2.name).toBe("A2");
  });

  it("resolves a user by unexpired session hash; not after expiry or delete", async () => {
    const u = await makeUser();
    await createAuthSession(env.DB, {
      userId: u.id,
      tokenHash: "hash1",
      now: NOW,
      expiresAt: "2026-08-16T00:00:00.000Z",
    });
    expect((await getUserBySessionHash(env.DB, "hash1", NOW))?.id).toBe(u.id);
    expect(await getUserBySessionHash(env.DB, "hash1", "2026-09-01T00:00:00.000Z")).toBeNull();
    await deleteAuthSession(env.DB, "hash1");
    expect(await getUserBySessionHash(env.DB, "hash1", NOW)).toBeNull();
  });
});

describe("vehicles (user-scoped)", () => {
  it("creates, lists, gets, updates, deletes within a user", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, {
      name: "Prius",
      make: "Toyota",
      model: "Prime",
      year: 2020,
      initialOdometer: 1000,
      now: NOW,
    });
    expect(v.name).toBe("Prius");
    expect(await listVehicles(env.DB, u.id)).toHaveLength(1);
    expect((await getVehicle(env.DB, u.id, v.id))?.id).toBe(v.id);

    const upd = await updateVehicle(env.DB, u.id, v.id, { name: "Prius 2" });
    expect(upd?.name).toBe("Prius 2");
    expect(upd?.make).toBe("Toyota"); // COALESCE keeps untouched fields

    expect(await deleteVehicle(env.DB, u.id, v.id)).toBe(1);
    expect(await listVehicles(env.DB, u.id)).toHaveLength(0);
  });

  it("does not leak or mutate another user's vehicle", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const v = await createVehicle(env.DB, a.id, { name: "A car", initialOdometer: 0, now: NOW });
    expect(await getVehicle(env.DB, b.id, v.id)).toBeNull();
    expect(await updateVehicle(env.DB, b.id, v.id, { name: "hijack" })).toBeNull();
    expect(await deleteVehicle(env.DB, b.id, v.id)).toBe(0);
    expect(await getVehicle(env.DB, a.id, v.id)).not.toBeNull();
  });
});

describe("fuel entries (user-scoped)", () => {
  it("creates and lists entries oldest-first for a vehicle", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", initialOdometer: 0, now: NOW });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-20",
      odometer: 1600,
      volume: 40,
      cost: 4000,
      isFull: true,
      location: "Pump B",
      now: NOW,
    });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      isFull: false,
      location: "Pump A",
      now: NOW,
    });
    const list = await listFuelEntries(env.DB, u.id, v.id);
    expect(list.map((e) => e.date)).toEqual(["2026-01-01", "2026-01-20"]);
    expect(list[0].is_full).toBe(0);
    expect(list[1].is_full).toBe(1);
  });

  it("updates and deletes a fuel entry, scoped to the owner", async () => {
    const u = await makeUser();
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, u.id, { name: "Car", initialOdometer: 0, now: NOW });
    const e = await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      isFull: true,
      now: NOW,
    });
    expect((await getFuelEntry(env.DB, u.id, e.id))?.id).toBe(e.id);
    expect(await getFuelEntry(env.DB, other.id, e.id)).toBeNull();

    const upd = await updateFuelEntry(env.DB, u.id, e.id, { cost: 3500 });
    expect(upd?.cost).toBe(3500);
    expect(await updateFuelEntry(env.DB, other.id, e.id, { cost: 1 })).toBeNull();

    expect(await deleteFuelEntry(env.DB, other.id, e.id)).toBe(0);
    expect(await deleteFuelEntry(env.DB, u.id, e.id)).toBe(1);
  });

  it("deleting a vehicle removes its fuel entries", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", initialOdometer: 0, now: NOW });
    await createFuelEntry(env.DB, u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      isFull: true,
      now: NOW,
    });
    await deleteVehicle(env.DB, u.id, v.id);
    expect(await listFuelEntries(env.DB, u.id, v.id)).toHaveLength(0);
  });
});
