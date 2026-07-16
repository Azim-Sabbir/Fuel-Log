import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestGet as listFuel, onRequestPost as createFuel } from "../../functions/api/fuel";
import {
  onRequestPut as updateFuel,
  onRequestDelete as deleteFuel,
} from "../../functions/api/fuel/[id]";
import { upsertUserByGoogleSub, createVehicle } from "../../lib/db";

const NOW = new Date().toISOString();
async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
}
async function post(userId: number, body: unknown) {
  return createFuel(authCtx("/api/fuel", userId, { method: "POST", body }));
}

beforeEach(resetDb);

describe("POST /api/fuel", () => {
  it("creates an entry on an owned vehicle", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
      isFull: true,
      location: "Pump A",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.entry.volume).toBe(30);
    expect(body.entry.is_full).toBe(1);
    expect(body.entry.location).toBe("Pump A");
  });

  it("400 on an invalid date", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, date: "bad", odometer: 1000, volume: 30, cost: 3000 });
    expect(res.status).toBe(400);
  });

  it("400 when volume is not positive", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, date: "2026-01-01", odometer: 1000, volume: 0, cost: 3000 });
    expect(res.status).toBe(400);
  });

  it("404 when the vehicle is not owned", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, date: "2026-01-01", odometer: 1000, volume: 30, cost: 3000 });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/fuel", () => {
  it("lists a vehicle's entries oldest-first", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    await post(u.id, { vehicleId: v.id, date: "2026-01-20", odometer: 1600, volume: 40, cost: 4000 });
    await post(u.id, { vehicleId: v.id, date: "2026-01-01", odometer: 1000, volume: 30, cost: 3000 });
    const res = await listFuel(authCtx(`/api/fuel?vehicleId=${v.id}`, u.id));
    const body = (await res.json()) as any;
    expect(body.entries.map((e: any) => e.date)).toEqual(["2026-01-01", "2026-01-20"]);
  });

  it("400 without a vehicleId", async () => {
    const u = await makeUser();
    const res = await listFuel(authCtx("/api/fuel", u.id));
    expect(res.status).toBe(400);
  });
});

describe("PUT/DELETE /api/fuel/:id", () => {
  it("updates and deletes an owned entry", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const created = (await (await post(u.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
    })).json()) as any;
    const id = created.entry.id;

    const upd = await updateFuel(
      authCtx(`/api/fuel/${id}`, u.id, { method: "PUT", body: { cost: 3500 }, params: { id: String(id) } })
    );
    expect(upd.status).toBe(200);
    expect(((await upd.json()) as any).entry.cost).toBe(3500);

    const del = await deleteFuel(
      authCtx(`/api/fuel/${id}`, u.id, { method: "DELETE", params: { id: String(id) } })
    );
    expect(del.status).toBe(200);
  });

  it("404 deleting another user's entry", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const created = (await (await post(other.id, {
      vehicleId: v.id,
      date: "2026-01-01",
      odometer: 1000,
      volume: 30,
      cost: 3000,
    })).json()) as any;
    const res = await deleteFuel(
      authCtx(`/api/fuel/${created.entry.id}`, u.id, {
        method: "DELETE",
        params: { id: String(created.entry.id) },
      })
    );
    expect(res.status).toBe(404);
  });
});
