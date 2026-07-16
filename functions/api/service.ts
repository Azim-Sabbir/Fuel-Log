import { getVehicle, listServiceEntries, createServiceEntry, getTrip } from "../../lib/db";
import { json } from "../../lib/http";
import { asNumber, asString, asTrimmedString, isDateStr } from "../../lib/validate";
import type { Env, AuthData } from "../../lib/env";

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const raw = new URL(ctx.request.url).searchParams.get("vehicleId");
  if (raw === null || !/^\d+$/.test(raw)) return json({ error: "vehicleId_required" }, 400);
  const vehicleId = Number(raw);

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  return json({ entries: await listServiceEntries(ctx.env.DB, ctx.data.userId, vehicleId) });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const vehicleId = asNumber(body.vehicleId);
  const odometer = asNumber(body.odometer);
  const type = asTrimmedString(body.type);
  const cost = asNumber(body.cost) ?? 0;

  if (vehicleId === undefined || !isDateStr(body.date) || odometer === undefined || odometer < 0 || !type || cost < 0) {
    return json({ error: "invalid_entry" }, 400);
  }

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  const tripId = asNumber(body.tripId);
  if (tripId !== undefined && !(await getTrip(ctx.env.DB, ctx.data.userId, tripId))) {
    return json({ error: "trip_not_found" }, 404);
  }

  const entry = await createServiceEntry(ctx.env.DB, ctx.data.userId, {
    vehicleId,
    date: body.date,
    odometer,
    type,
    cost,
    location: asString(body.location) ?? null,
    notes: asString(body.notes) ?? null,
    tripId: tripId ?? null,
    receiptKey: asString(body.receiptKey) ?? null,
    now: new Date().toISOString(),
  });
  return json({ entry }, 201);
};
