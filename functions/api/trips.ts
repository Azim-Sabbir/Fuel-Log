import { getVehicle, listTrips, createTrip } from "../../lib/db";
import { json } from "../../lib/http";
import { asNumber, asTrimmedString, isDateStr } from "../../lib/validate";
import type { Env, AuthData } from "../../lib/env";

const CATEGORIES = new Set(["business", "personal", "vacation"]);

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const raw = new URL(ctx.request.url).searchParams.get("vehicleId");
  if (raw === null || !/^\d+$/.test(raw)) return json({ error: "vehicleId_required" }, 400);
  const vehicleId = Number(raw);

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  return json({ trips: await listTrips(ctx.env.DB, ctx.data.userId, vehicleId) });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const vehicleId = asNumber(body.vehicleId);
  const name = asTrimmedString(body.name);
  if (vehicleId === undefined || !name) return json({ error: "invalid_trip" }, 400);

  for (const d of [body.startDate, body.endDate]) {
    if (d != null && !isDateStr(d)) return json({ error: "invalid_date" }, 400);
  }
  const category = CATEGORIES.has(String(body.category)) ? String(body.category) : "personal";

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  const trip = await createTrip(ctx.env.DB, ctx.data.userId, {
    vehicleId,
    name,
    category,
    startDate: isDateStr(body.startDate) ? body.startDate : null,
    endDate: isDateStr(body.endDate) ? body.endDate : null,
    now: new Date().toISOString(),
  });
  return json({ trip }, 201);
};
