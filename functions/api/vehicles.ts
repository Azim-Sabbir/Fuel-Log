import { listVehicles, createVehicle } from "../../lib/db";
import { json } from "../../lib/http";
import { asTrimmedString, asString, asNumber } from "../../lib/validate";
import type { Env, AuthData } from "../../lib/env";

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  return json({ vehicles: await listVehicles(ctx.env.DB, ctx.data.userId) });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = asTrimmedString(body.name);
  if (!name) return json({ error: "name_required" }, 400);

  const vehicle = await createVehicle(ctx.env.DB, ctx.data.userId, {
    name,
    make: asString(body.make) ?? null,
    model: asString(body.model) ?? null,
    year: asNumber(body.year) ?? null,
    initialOdometer: asNumber(body.initialOdometer) ?? 0,
    now: new Date().toISOString(),
  });
  return json({ vehicle }, 201);
};
