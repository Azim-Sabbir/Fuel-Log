import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestGet as listTripsH, onRequestPost as createTripH } from "../../functions/api/trips";
import {
  onRequestGet as tripDetail,
  onRequestPut as updateTripH,
  onRequestDelete as deleteTripH,
} from "../../functions/api/trips/[id]";
import { onRequestPost as createFuelH } from "../../functions/api/fuel";
import { upsertUserByGoogleSub, createVehicle } from "../../lib/db";

const NOW = new Date().toISOString();
beforeEach(resetDb);

async function setup(sub = "g1") {
  const u = await upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
  const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
  return { u, v };
}
function makeTrip(userId: number, body: unknown) {
  return createTripH(authCtx("/api/trips", userId, { method: "POST", body }));
}

describe("POST /api/trips", () => {
  it("creates a trip", async () => {
    const { u, v } = await setup();
    const res = await makeTrip(u.id, { vehicleId: v.id, name: "Cox's Bazar", category: "vacation" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.trip.name).toBe("Cox's Bazar");
    expect(body.trip.category).toBe("vacation");
  });

  it("400 without a name", async () => {
    const { u, v } = await setup();
    expect((await makeTrip(u.id, { vehicleId: v.id })).status).toBe(400);
  });

  it("404 when the vehicle is not owned", async () => {
    const me = await setup("me");
    const other = await setup("other");
    expect((await makeTrip(me.u.id, { vehicleId: other.v.id, name: "X" })).status).toBe(404);
  });
});

describe("trip detail with assigned entries + totals data", () => {
  it("assigns a fuel entry to a trip and returns it in the detail", async () => {
    const { u, v } = await setup();
    const trip = (await (await makeTrip(u.id, { vehicleId: v.id, name: "Trip" })).json()) as any;
    const tripId = trip.trip.id;

    const fuelRes = await createFuelH(
      authCtx("/api/fuel", u.id, {
        method: "POST",
        body: { vehicleId: v.id, date: "2026-01-01", odometer: 1000, volume: 30, cost: 3000, tripId },
      })
    );
    expect(fuelRes.status).toBe(201);

    const detail = (await (
      await tripDetail(authCtx(`/api/trips/${tripId}`, u.id, { params: { id: String(tripId) } }))
    ).json()) as any;
    expect(detail.trip.id).toBe(tripId);
    expect(detail.fuelEntries).toHaveLength(1);
    expect(detail.serviceEntries).toHaveLength(0);
  });

  it("rejects assigning a fuel entry to someone else's trip", async () => {
    const me = await setup("me");
    const other = await setup("other");
    const othersTrip = (await (await makeTrip(other.u.id, { vehicleId: other.v.id, name: "T" })).json()) as any;
    const res = await createFuelH(
      authCtx("/api/fuel", me.u.id, {
        method: "POST",
        body: {
          vehicleId: me.v.id,
          date: "2026-01-01",
          odometer: 1000,
          volume: 30,
          cost: 3000,
          tripId: othersTrip.trip.id,
        },
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("GET list + PUT/DELETE /api/trips/:id", () => {
  it("lists, updates, and deletes; blocks other users", async () => {
    const me = await setup("me");
    const other = await setup("other");
    const trip = (await (await makeTrip(me.u.id, { vehicleId: me.v.id, name: "Trip" })).json()) as any;
    const id = trip.trip.id;

    const list = (await (await listTripsH(authCtx(`/api/trips?vehicleId=${me.v.id}`, me.u.id))).json()) as any;
    expect(list.trips).toHaveLength(1);

    const upd = await updateTripH(
      authCtx(`/api/trips/${id}`, me.u.id, { method: "PUT", body: { name: "Renamed" }, params: { id: String(id) } })
    );
    expect(((await upd.json()) as any).trip.name).toBe("Renamed");

    expect(
      (await deleteTripH(authCtx(`/api/trips/${id}`, other.u.id, { method: "DELETE", params: { id: String(id) } }))).status
    ).toBe(404);
    expect(
      (await deleteTripH(authCtx(`/api/trips/${id}`, me.u.id, { method: "DELETE", params: { id: String(id) } }))).status
    ).toBe(200);
  });
});
