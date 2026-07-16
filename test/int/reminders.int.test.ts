import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestGet as listRem, onRequestPost as createRem } from "../../functions/api/reminders";
import {
  onRequestPut as updateRem,
  onRequestDelete as deleteRem,
} from "../../functions/api/reminders/[id]";
import { upsertUserByGoogleSub, createVehicle } from "../../lib/db";

const NOW = new Date().toISOString();
async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
}
async function post(userId: number, body: unknown) {
  return createRem(authCtx("/api/reminders", userId, { method: "POST", body }));
}

beforeEach(resetDb);

describe("POST /api/reminders", () => {
  it("creates a reminder on an owned vehicle", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, {
      vehicleId: v.id,
      type: "Oil change",
      intervalKm: 5000,
      intervalDays: 180,
      lastDoneOdometer: 50000,
      lastDoneDate: "2026-01-01",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.reminder.type).toBe("Oil change");
    expect(body.reminder.interval_km).toBe(5000);
  });

  it("400 when type is missing", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, intervalKm: 5000 });
    expect(res.status).toBe(400);
  });

  it("404 when the vehicle is not owned", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, type: "Oil" });
    expect(res.status).toBe(404);
  });
});

describe("GET + PUT/DELETE /api/reminders", () => {
  it("lists, updates, and deletes; blocks other users", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const created = (await (await post(u.id, { vehicleId: v.id, type: "Oil", intervalKm: 5000 })).json()) as any;
    const id = created.reminder.id;

    const list = (await (await listRem(authCtx(`/api/reminders?vehicleId=${v.id}`, u.id))).json()) as any;
    expect(list.reminders).toHaveLength(1);

    const upd = await updateRem(
      authCtx(`/api/reminders/${id}`, u.id, {
        method: "PUT",
        body: { lastDoneOdometer: 55000 },
        params: { id: String(id) },
      })
    );
    expect(((await upd.json()) as any).reminder.last_done_odometer).toBe(55000);

    expect(
      (await deleteRem(authCtx(`/api/reminders/${id}`, other.id, { method: "DELETE", params: { id: String(id) } }))).status
    ).toBe(404);
    expect(
      (await deleteRem(authCtx(`/api/reminders/${id}`, u.id, { method: "DELETE", params: { id: String(id) } }))).status
    ).toBe(200);
  });
});
