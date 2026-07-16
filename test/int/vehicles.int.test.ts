import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestGet as list, onRequestPost as create } from "../../functions/api/vehicles";
import {
  onRequestPut as update,
  onRequestDelete as remove,
} from "../../functions/api/vehicles/[id]";
import { upsertUserByGoogleSub, createVehicle } from "../../lib/db";

const NOW = new Date().toISOString();

async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
}

beforeEach(resetDb);

describe("POST /api/vehicles", () => {
  it("creates a vehicle for the user", async () => {
    const u = await makeUser();
    const res = await create(
      authCtx("/api/vehicles", u.id, {
        method: "POST",
        body: { name: "Prius", make: "Toyota", initialOdometer: 1000 },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.vehicle.name).toBe("Prius");
    expect(body.vehicle.initial_odometer).toBe(1000);
  });

  it("400 when name is missing", async () => {
    const u = await makeUser();
    const res = await create(authCtx("/api/vehicles", u.id, { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/vehicles", () => {
  it("lists only the user's own vehicles", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    await createVehicle(env.DB, u.id, { name: "Mine", now: NOW });
    await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await list(authCtx("/api/vehicles", u.id));
    const body = (await res.json()) as any;
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].name).toBe("Mine");
  });
});

describe("PUT/DELETE /api/vehicles/:id", () => {
  it("updates and deletes an owned vehicle", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Old", now: NOW });

    const upd = await update(
      authCtx(`/api/vehicles/${v.id}`, u.id, {
        method: "PUT",
        body: { name: "New" },
        params: { id: String(v.id) },
      })
    );
    expect(upd.status).toBe(200);
    expect(((await upd.json()) as any).vehicle.name).toBe("New");

    const del = await remove(
      authCtx(`/api/vehicles/${v.id}`, u.id, { method: "DELETE", params: { id: String(v.id) } })
    );
    expect(del.status).toBe(200);
  });

  it("404 when acting on another user's vehicle", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const v = await createVehicle(env.DB, other.id, { name: "Theirs", now: NOW });
    const res = await update(
      authCtx(`/api/vehicles/${v.id}`, u.id, {
        method: "PUT",
        body: { name: "hijack" },
        params: { id: String(v.id) },
      })
    );
    expect(res.status).toBe(404);
  });
});
