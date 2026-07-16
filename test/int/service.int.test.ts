import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestGet as listSvc, onRequestPost as createSvc } from "../../functions/api/service";
import {
  onRequestPut as updateSvc,
  onRequestDelete as deleteSvc,
} from "../../functions/api/service/[id]";
import { upsertUserByGoogleSub, createVehicle } from "../../lib/db";

const NOW = new Date().toISOString();
async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
}
async function post(userId: number, body: unknown) {
  return createSvc(authCtx("/api/service", userId, { method: "POST", body }));
}

beforeEach(resetDb);

describe("POST /api/service", () => {
  it("creates a service entry on an owned vehicle", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, {
      vehicleId: v.id,
      date: "2026-03-01",
      odometer: 52000,
      type: "Oil change",
      cost: 1500,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.entry.type).toBe("Oil change");
    expect(body.entry.cost).toBe(1500);
  });

  it("400 when type is missing", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, date: "2026-03-01", odometer: 52000 });
    expect(res.status).toBe(400);
  });

  it("404 when the vehicle is not owned", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await post(u.id, { vehicleId: v.id, date: "2026-03-01", odometer: 52000, type: "Oil" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/service", () => {
  it("lists a vehicle's service entries oldest-first", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    await post(u.id, { vehicleId: v.id, date: "2026-03-01", odometer: 52000, type: "Oil" });
    await post(u.id, { vehicleId: v.id, date: "2026-01-10", odometer: 50000, type: "Tires" });
    const res = await listSvc(authCtx(`/api/service?vehicleId=${v.id}`, u.id));
    const body = (await res.json()) as any;
    expect(body.entries.map((e: any) => e.date)).toEqual(["2026-01-10", "2026-03-01"]);
  });
});

describe("PUT/DELETE /api/service/:id", () => {
  it("updates and deletes an owned entry; blocks others", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const created = (await (await post(u.id, {
      vehicleId: v.id,
      date: "2026-03-01",
      odometer: 52000,
      type: "Oil",
      cost: 1500,
    })).json()) as any;
    const id = created.entry.id;

    const upd = await updateSvc(
      authCtx(`/api/service/${id}`, u.id, { method: "PUT", body: { cost: 1600 }, params: { id: String(id) } })
    );
    expect(((await upd.json()) as any).entry.cost).toBe(1600);

    expect(
      (await deleteSvc(authCtx(`/api/service/${id}`, other.id, { method: "DELETE", params: { id: String(id) } }))).status
    ).toBe(404);
    expect(
      (await deleteSvc(authCtx(`/api/service/${id}`, u.id, { method: "DELETE", params: { id: String(id) } }))).status
    ).toBe(200);
  });
});
