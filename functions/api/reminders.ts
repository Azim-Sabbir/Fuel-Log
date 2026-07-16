import { getVehicle, listReminders, createReminder } from "../../lib/db";
import { json } from "../../lib/http";
import { asNumber, asTrimmedString, isDateStr } from "../../lib/validate";
import type { Env, AuthData } from "../../lib/env";

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const raw = new URL(ctx.request.url).searchParams.get("vehicleId");
  if (raw === null || !/^\d+$/.test(raw)) return json({ error: "vehicleId_required" }, 400);
  const vehicleId = Number(raw);

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  return json({ reminders: await listReminders(ctx.env.DB, ctx.data.userId, vehicleId) });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const vehicleId = asNumber(body.vehicleId);
  const type = asTrimmedString(body.type);
  if (vehicleId === undefined || !type) return json({ error: "invalid_reminder" }, 400);
  if (body.lastDoneDate != null && !isDateStr(body.lastDoneDate)) {
    return json({ error: "invalid_date" }, 400);
  }

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  const reminder = await createReminder(ctx.env.DB, ctx.data.userId, {
    vehicleId,
    type,
    intervalKm: asNumber(body.intervalKm) ?? null,
    intervalDays: asNumber(body.intervalDays) ?? null,
    lastDoneOdometer: asNumber(body.lastDoneOdometer) ?? null,
    lastDoneDate: isDateStr(body.lastDoneDate) ? body.lastDoneDate : null,
    now: new Date().toISOString(),
  });
  return json({ reminder }, 201);
};
