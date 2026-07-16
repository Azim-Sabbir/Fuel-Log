import { updateVehicle, deleteVehicle } from "../../../lib/db";
import { json } from "../../../lib/http";
import { asString, asNumber } from "../../../lib/validate";
import type { Env, AuthData } from "../../../lib/env";

export const onRequestPut: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateVehicle(ctx.env.DB, ctx.data.userId, id, {
    name: asString(body.name),
    make: asString(body.make),
    model: asString(body.model),
    year: asNumber(body.year),
    initialOdometer: asNumber(body.initialOdometer),
  });
  if (!updated) return json({ error: "not_found" }, 404);
  return json({ vehicle: updated });
};

export const onRequestDelete: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const n = await deleteVehicle(ctx.env.DB, ctx.data.userId, id);
  if (n === 0) return json({ error: "not_found" }, 404);
  return json({ deleted: n });
};
